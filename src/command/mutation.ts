import { existsSync, globSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, matchesGlob } from 'node:path';
import process from 'node:process';

import { readSettings } from '../../lint/index.rules.js';
import { refusal } from '../../lint/kit/catalogue/lesson.js';
import { readCommandLine } from '../../lint/kit/checker/command-line.js';
import { DEV_OUTPUT } from '../../lint/kit/project/build-plan.js';
import { objectOf, parsedObject } from '../../lint/kit/project/json.js';
import type { Resolution } from '../../lint/kit/project/preset.js';
import { workspaceMembers } from '../../lint/kit/project/workspace-members.js';
import { projectBinary } from './check/setup.js';
import { judgedReport, verdictOf } from './mutation-survivors.js';
import { handOver } from './processes.js';
import { badge, print } from './terminal.js';

const ARTIFACTS = '.artifacts';

const OUT = `${ARTIFACTS}/stryker`;

const NEVER_MUTATED = [
    '**/*.test.ts',
    '**/*.test.tsx',
    '**/*.test-d.ts',
    '**/*.fixtures.ts',
    '**/_fixtures/**',
    '**/_expected/**',
];

// outside: Stryker 10 names a test by its suites and title joined with a space, where Vitest 5 joins them with ` > `: without this plugin every mutant runs no test and survives.
const TEST_NAME_PLUGIN_SOURCE = `const strykerTestNames = {
    configureVitest({ project }) {
        let pattern;
        Object.defineProperty(project.config, 'testNamePattern', {
            configurable: true,
            enumerable: true,
            get: () => pattern,
            set: (stated) => {
                pattern = stated === undefined ? undefined : new RegExp((stated instanceof RegExp ? stated.source : stated).replaceAll('\\\\-', '-').replaceAll(' ', '(?: > | )'), 'u');
            },
        });
    },
    name: 'stryker-test-names',
};`;

// invariant: a spawned process runs the instrumented build and reads the active mutant from its environment.
const ACTIVE_MUTANT_SETUP_SOURCE = `import { afterAll, beforeEach } from 'vitest';

const namespace = () => globalThis.__stryker__;

beforeEach(() => {
    const active = namespace()?.activeMutant;
    if (active === undefined) {
        delete process.env.__STRYKER_ACTIVE_MUTANT__;
    } else {
        process.env.__STRYKER_ACTIVE_MUTANT__ = String(active);
    }
});

afterAll(() => {
    delete namespace()?.mutantCoverage;
});
`;

// outside: the checks a test runs read the git tree, and the sandbox lies in the ignored .artifacts/, where git sees none.
const sandboxScriptSource = (
    build: boolean,
): string => `import { execFileSync } from 'node:child_process';

execFileSync('git', ['init', '--quiet']);
execFileSync('git', ['add', '--all']);
${build ? "execFileSync('npm', ['run', 'build'], { stdio: 'inherit' });\n" : ''}`;

type MutationScope = { exclude: string[]; ignore: string[]; mutated: string[] };

const extensionGlob = (extensions: readonly string[]): string =>
    extensions.length === 1 ? (extensions[0] ?? 'ts') : `{${extensions.join(',')}}`;

function sourceGlobsOf(unit: string, { resolved }: Resolution): string[] {
    const prefix = unit === '.' ? '' : `${unit}/`;

    return resolved.presets.flatMap(({ sources }) =>
        sources === undefined
            ? []
            : sources.roots.map(
                  (root) => `${prefix}${root}/**/*.${extensionGlob(sources.extensions)}`,
              ),
    );
}

async function mutationScopeOf(project: string): Promise<MutationScope> {
    const root = await readSettings(project);
    const members = await Promise.all(
        workspaceMembers(project).map(
            async (member) =>
                [member, await readSettings(join(project, member))] satisfies [string, Resolution],
        ),
    );
    const declared = objectOf(objectOf(root.resolved.sections.typescript).mutation);
    const derived = [['.', root] satisfies [string, Resolution], ...members].flatMap(
        ([unit, resolution]) => sourceGlobsOf(unit, resolution),
    );

    return {
        exclude: Object.keys(objectOf(declared.exclude)),
        ignore: Object.keys(objectOf(declared.ignore)),
        mutated: [...new Set([...derived, ...Object.keys(objectOf(declared.mutate))])],
    };
}

const oneGlob = (globs: readonly string[]): string =>
    globs.length === 1 ? (globs[0] ?? '') : `{${globs.join(',')}}`;

const typeCheckedGlob = (mutated: readonly string[]): string =>
    oneGlob(
        mutated.map((glob) =>
            glob.replace(/\*\.(?<extension>[^/]+)$/u, '!(*.test-d).$<extension>'),
        ),
    );

const TEST_SUFFIXES = ['.test.ts', '.test.tsx'];

/** A module test proves the module beside it: a source with no `<name>.test.ts` is the specs' to prove, measured by range with `--specs`. */
function testedSources(project: string, scope: MutationScope): string[] {
    const never = [...NEVER_MUTATED, ...scope.ignore];
    const hasItsTest = (file: string): boolean =>
        TEST_SUFFIXES.some((suffix) =>
            existsSync(join(project, file.replace(/\.[cm]?[jt]sx?$/u, suffix))),
        );
    return [...new Set(scope.mutated.flatMap((glob) => globSync(glob, { cwd: project })))]
        .filter((file) => !never.some((pattern) => matchesGlob(file, pattern)) && hasItsTest(file))
        .toSorted();
}

function buildsOf(project: string): boolean {
    try {
        const { scripts } = parsedObject(readFileSync(join(project, 'package.json'), 'utf8'));

        return objectOf(scripts).build !== undefined;
    } catch {
        return false;
    }
}

function mutationVitestConfigSource(scope: MutationScope, specs: boolean): string {
    const kept = specs
        ? 'projects.filter((project) => project.test?.browser?.enabled !== true)'
        : "projects.filter((project) => project.test?.name === 'unit')";
    const setup = specs ? `setupFiles: [${JSON.stringify(`${OUT}/active-mutant.mjs`)}], ` : '';

    return `import { mergeConfig } from 'vitest/config';

import declared from '../../vitest.config.ts';

const project = typeof declared === 'function' ? await declared({ command: 'serve', mode: 'test' }) : await declared;

${TEST_NAME_PLUGIN_SOURCE}

const projects = project.test?.projects ?? [];

export default {
    ...project,
    test: {
        ...project.test,
        coverage: { enabled: false },
        projects: ${kept}.map((one) =>
            mergeConfig(one, { plugins: [strykerTestNames], test: { ${setup}exclude: ${JSON.stringify(scope.exclude)} } }),
        ),
    },
};
`;
}

function strykerConfig(scope: MutationScope, specs: boolean, tested: readonly string[]): object {
    const shared = {
        $schema: '../../node_modules/@stryker-mutator/core/schema/stryker-schema.json',
        buildCommand: `node ${OUT}/sandbox.mjs`,
        checkers: [],
        disableTypeChecks: typeCheckedGlob(scope.mutated),
        ignorePatterns: [`/${ARTIFACTS}/**`, `!/${OUT}/*.mjs`, `!/${DEV_OUTPUT}/**`],
        mutate: specs
            ? [...scope.mutated, ...[...NEVER_MUTATED, ...scope.ignore].map((glob) => `!${glob}`)]
            : tested,
        plugins: [createRequire(import.meta.url).resolve('@stryker-mutator/vitest-runner')],
        tempDirName: `${OUT}/tmp`,
        testRunner: 'vitest',
        vitest: { configFile: `${OUT}/vitest.config.mjs`, ...(specs ? { related: false } : {}) },
    };

    return specs
        ? {
              ...shared,
              concurrency: 6,
              coverageAnalysis: 'off',
              incremental: false,
              jsonReporter: { fileName: `${OUT}/specs-report.json` },
              reporters: ['clear-text', 'json', 'progress'],
              timeoutMS: 60_000,
          }
        : {
              ...shared,
              concurrency: 8,
              coverageAnalysis: 'perTest',
              htmlReporter: { fileName: `${OUT}/report.html` },
              ignoreStatic: true,
              incremental: true,
              incrementalFile: `${OUT}/incremental.json`,
              jsonReporter: { fileName: `${OUT}/report.json` },
              reporters: ['clear-text', 'html', 'json', 'progress'],
              timeoutMS: 30_000,
          };
}

function judgedRun(measured: ReadonlySet<string>): number {
    const report = join(OUT, 'report.json');
    if (!existsSync(report)) {
        print(
            `${refusal({
                fix: 'run typescript mutation again, and read what Stryker printed above if the report is still missing',
                found: `Stryker exited 0 and left no ${report}`,
                read: 'docs/reference/quality-checks.md#mutation',
                why: 'the verdict is read from the report, and a run judged from none would pass having judged nothing',
            })}\n`,
        );

        return 1;
    }
    const parsed: unknown = JSON.parse(readFileSync(report, 'utf8'));
    const verdict = verdictOf(judgedReport(parsed, measured));
    print(`\n${verdict.lines.join('\n')}\n`);

    return verdict.status;
}

export async function mutation(args: readonly string[]): Promise<number> {
    const project = process.cwd();
    const commandLine = readCommandLine(args, ['--mutate']);
    const specs = commandLine.has('--specs');
    const mutate = commandLine.value('--mutate');
    if (specs && mutate === undefined) {
        print(
            `${refusal({
                fix: 'name the ranges to measure: typescript mutation --specs --mutate src/a.ts:10-20,src/b.ts:4-4',
                found: 'typescript mutation --specs names no ranges',
                read: 'docs/reference/quality-checks.md#mutation',
                why: 'every mutant reruns the whole suite and the processes it spawns, so a run is pointed at the lines it measures',
            })}\n`,
        );

        return 1;
    }
    const scope = await mutationScopeOf(project);
    mkdirSync(OUT, { recursive: true });
    writeFileSync(join(OUT, 'vitest.config.mjs'), mutationVitestConfigSource(scope, specs));
    writeFileSync(join(OUT, 'active-mutant.mjs'), ACTIVE_MUTANT_SETUP_SOURCE);
    writeFileSync(join(OUT, 'sandbox.mjs'), sandboxScriptSource(specs && buildsOf(project)));
    const config = join(OUT, specs ? 'stryker.specs.config.json' : 'stryker.config.json');
    const tested = testedSources(project, scope);
    if (!specs && tested.length === 0) {
        print(
            `${badge('TYPESCRIPT')} No source has a module test beside it: nothing to measure.\n`,
        );
        return 0;
    }
    writeFileSync(config, `${JSON.stringify(strykerConfig(scope, specs, tested), null, 4)}\n`);
    print(`${badge('TYPESCRIPT')} Measuring the suite against mutants of the sources...\n\n`);

    const status = await handOver(
        projectBinary('stryker'),
        ['run', config, ...(mutate === undefined ? [] : ['--mutate', mutate])],
        project,
    );
    if (status !== 0 || specs) {
        return status;
    }
    return judgedRun(
        new Set(
            mutate === undefined
                ? tested
                : mutate.split(',').map((range) => range.replace(/:[^:]*$/u, '')),
        ),
    );
}
