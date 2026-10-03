import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import process from 'node:process';

import { readSettings } from '../../lint/index.rules.js';
import { refusal } from '../../lint/kit/catalogue/lesson.js';
import { readCommandLine } from '../../lint/kit/checker/command-line.js';
import { objectOf, parsedObject } from '../../lint/kit/project/json.js';
import type { Resolution } from '../../lint/kit/project/preset.js';
import { workspaceMembers } from '../../lint/kit/project/workspace-members.js';
import { projectBinary } from './check/setup.js';
import { handOver } from './processes.js';
import { badge, print } from './terminal.js';
import { projectRoot } from './toolchain.js';

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

// Stryker 10 names a test by its suites and title joined with a space, where Vitest 5 joins them with ` > `: without this plugin every mutant runs no test and survives.
const TEST_NAMES = `const strykerTestNames = {
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

// A spawned process runs the instrumented build and reads the active mutant from its environment.
const ACTIVE_MUTANT = `import { afterAll, beforeEach } from 'vitest';

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

// The checks a test runs read the git tree, and the sandbox lies in the ignored .artifacts/, where git sees none.
const sandboxScript = (
    build: boolean,
): string => `import { execFileSync } from 'node:child_process';

execFileSync('git', ['init', '--quiet']);
execFileSync('git', ['add', '--all']);
${build ? "execFileSync('npm', ['run', 'build'], { stdio: 'inherit' });\n" : ''}`;

type Settings = { exclude: string[]; ignore: string[]; mutated: string[] };

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

async function settingsOf(project: string): Promise<Settings> {
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

function buildsOf(project: string): boolean {
    try {
        const { scripts } = parsedObject(readFileSync(join(project, 'package.json'), 'utf8'));

        return objectOf(scripts).build !== undefined;
    } catch {
        return false;
    }
}

function vitestConfig(settings: Settings, specs: boolean): string {
    const kept = specs
        ? 'projects.filter((project) => project.test?.browser?.enabled !== true)'
        : "projects.filter((project) => project.test?.name === 'unit')";
    const setup = specs ? `setupFiles: [${JSON.stringify(`${OUT}/active-mutant.mjs`)}], ` : '';

    return `import { mergeConfig } from 'vitest/config';

import declared from '../../vitest.config.ts';

const project = typeof declared === 'function' ? await declared({ command: 'serve', mode: 'test' }) : await declared;

${TEST_NAMES}

const projects = project.test?.projects ?? [];

export default {
    ...project,
    test: {
        ...project.test,
        coverage: { enabled: false },
        projects: ${kept}.map((one) =>
            mergeConfig(one, { plugins: [strykerTestNames], test: { ${setup}exclude: ${JSON.stringify(settings.exclude)} } }),
        ),
    },
};
`;
}

function strykerConfig(settings: Settings, specs: boolean): object {
    const shared = {
        $schema: '../../node_modules/@stryker-mutator/core/schema/stryker-schema.json',
        buildCommand: `node ${OUT}/sandbox.mjs`,
        checkers: [],
        disableTypeChecks: typeCheckedGlob(settings.mutated),
        ignorePatterns: [`/${ARTIFACTS}/**`, `!/${OUT}/*.mjs`],
        mutate: [
            ...settings.mutated,
            ...[...NEVER_MUTATED, ...settings.ignore].map((glob) => `!${glob}`),
        ],
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

export async function mutation(args: readonly string[]): Promise<number> {
    const project = projectRoot();
    process.chdir(project);
    const commandLine = readCommandLine(args, ['--mutate']);
    const specs = commandLine.has('--specs');
    const mutate = commandLine.value('--mutate');
    if (specs && mutate === undefined) {
        print(
            `${refusal({
                fix: 'name the ranges to measure: typescript mutation --specs --mutate src/a.ts:10-20,src/b.ts:4-4',
                found: 'typescript mutation --specs names no ranges',
                read: 'docs/07-quality-checks.md#mutation',
                why: 'every mutant reruns the whole suite and the processes it spawns, so a run is pointed at the lines it measures',
            })}\n`,
        );

        return 1;
    }
    const settings = await settingsOf(project);
    mkdirSync(OUT, { recursive: true });
    writeFileSync(join(OUT, 'vitest.config.mjs'), vitestConfig(settings, specs));
    writeFileSync(join(OUT, 'active-mutant.mjs'), ACTIVE_MUTANT);
    writeFileSync(join(OUT, 'sandbox.mjs'), sandboxScript(specs && buildsOf(project)));
    const config = join(OUT, specs ? 'stryker.specs.config.json' : 'stryker.config.json');
    writeFileSync(config, `${JSON.stringify(strykerConfig(settings, specs), null, 4)}\n`);
    print(`${badge('TYPESCRIPT')} Measuring the suite against mutants of the sources...\n\n`);

    return await handOver(
        projectBinary('stryker'),
        ['run', config, ...(mutate === undefined ? [] : ['--mutate', mutate])],
        project,
    );
}
