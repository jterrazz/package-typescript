import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import process from 'node:process';

import { readSettings } from '../../lint/index.rules.js';
import { refusal } from '../../lint/kit/catalogue/lesson.js';
import { readCommandLine } from '../../lint/kit/checker/command-line.js';
import { objectOf, parsedObject } from '../../lint/kit/project/json.js';
import type { Resolution } from '../../lint/kit/project/preset.js';
import { workspaceMembers } from '../../lint/kit/project/workspace-members.js';
import { projectBinary } from './check/setup.js';
import { changeOf, namesACommit } from './mutation-change.js';
import {
    changedRanges,
    fileOf,
    FILES,
    narrowed,
    sourcesOf,
    strykerConfig,
} from './mutation-scope.js';
import type { MutationScope, Stage } from './mutation-scope.js';
import {
    CHILD_COVERAGE_SOURCE,
    MUTANT_SETUP_SOURCE,
    OUT,
    RAN_BY_TESTS_VARIABLE,
    sandboxScriptSource,
    vitestConfigSource,
} from './mutation-sources.js';
import { judgedRuns, leftToTheSuite, verdictOf } from './mutation-survivors.js';
import type { Judged, ModuleRun } from './mutation-survivors.js';
import { handOver } from './processes.js';
import { badge, print, RED, RESET } from './terminal.js';

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

function buildsOf(project: string): boolean {
    try {
        const { scripts } = parsedObject(readFileSync(join(project, 'package.json'), 'utf8'));

        return objectOf(scripts).build !== undefined;
    } catch {
        return false;
    }
}

/** A stage's report, or Stryker's status when it failed: a failed run leaves no report this one could be judged by. */
async function measured(
    scope: MutationScope,
    stage: Stage,
    project: string,
): Promise<{ ranByTests: ReadonlySet<string>; report: unknown } | { status: number }> {
    const files = FILES[stage.name];
    const suite = stage.name === 'suite';
    writeFileSync(join(OUT, files.vitest), vitestConfigSource(scope.exclude, suite));
    writeFileSync(join(OUT, files.sandbox), sandboxScriptSource(suite && buildsOf(project)));
    writeFileSync(
        join(OUT, files.config),
        `${JSON.stringify(strykerConfig(scope, stage), null, 4)}\n`,
    );
    const ranInto = mkdtempSync(join(project, OUT, 'ran-by-tests-'));
    process.env[RAN_BY_TESTS_VARIABLE] = ranInto;
    print(
        `${badge('TYPESCRIPT')} ${suite ? 'Measuring the whole suite against the changed lines no module test runs' : 'Measuring the module tests against mutants of the sources they test'}...\n\n`,
    );
    const status = await handOver(
        projectBinary('stryker'),
        ['run', join(OUT, files.config)],
        project,
    );
    const ranByTests = new Set(
        readdirSync(ranInto).flatMap((name) =>
            String(readFileSync(join(ranInto, name))).split('\n'),
        ),
    );
    rmSync(ranInto, { recursive: true });

    if (status !== 0) {
        return { status };
    }
    const report = String(readFileSync(join(OUT, `${files.report}.json`)));

    return { ranByTests, report: JSON.parse(report) };
}

type Measured = { ranByTests: ReadonlySet<string>; report: unknown };

const NOTHING_MEASURED: Measured = { ranByTests: new Set(), report: undefined };

/** A stage's next step on what it measured — nothing when it measured nothing — or Stryker's status when it failed. */
async function afterStage(
    outcome: Measured | undefined | { status: number },
    next: (measured: Measured) => number | Promise<number>,
): Promise<number> {
    if (outcome !== undefined && 'status' in outcome) {
        return outcome.status;
    }

    return await next(outcome ?? NOTHING_MEASURED);
}

function printed(judged: Judged): number {
    const verdict = verdictOf(judged);
    print(`\n${verdict.lines.join('\n')}\n`);

    return verdict.status;
}

async function judgedAfterTheSuite({
    modulesRun,
    project,
    ranges,
    scope,
    since,
    untested,
}: {
    modulesRun: ModuleRun;
    project: string;
    ranges: readonly string[] | undefined;
    scope: MutationScope;
    since: string;
    untested: readonly string[];
}): Promise<number> {
    const { changed, note } = changeOf(project, { ranges, since });
    if (note !== undefined) {
        print(`${badge('TYPESCRIPT')} ${note}\n`);
    }
    const left = [
        ...changedRanges(untested, changed),
        ...leftToTheSuite(modulesRun, changed),
    ];
    if (left.length === 0) {
        return printed(judgedRuns(modulesRun));
    }
    return await afterStage(
        await measured(scope, { mutate: left, name: 'suite' }, project),
        ({ report }) => printed(judgedRuns(modulesRun, { changed, report })),
    );
}

const blankAsUnset = (value: string | undefined): string | undefined =>
    value === undefined || value.trim() === '' ? undefined : value;

export async function mutation(args: readonly string[]): Promise<number> {
    const project = process.cwd();
    const commandLine = readCommandLine(args, ['--mutate', '--since']);
    const ranges = commandLine.value('--mutate')?.split(',');
    const named =
        commandLine.value('--since') ?? blankAsUnset(process.env.TYPESCRIPT_MUTATION_SINCE);
    if (named !== undefined && !namesACommit(project, named)) {
        print(
            `${RED}${refusal({
                fix: 'name a commit this clone holds — fetch it, or name the merge-base with the default branch — or leave --since and TYPESCRIPT_MUTATION_SINCE unset to measure the working tree against HEAD',
                found: `git names no commit ${named}`,
                read: 'docs/reference/quality-checks.md#mutation',
                why: 'the whole suite measures the lines changed since that commit, and a run that cannot name them would pass having measured nothing',
            })}${RESET}\n`,
        );

        return 1;
    }
    const since = named ?? 'HEAD';
    const scope = await mutationScopeOf(project);
    const { tested, untested } = sourcesOf(project, scope);
    mkdirSync(OUT, { recursive: true });
    writeFileSync(join(OUT, 'mutant-setup.mjs'), MUTANT_SETUP_SOURCE);
    writeFileSync(join(OUT, 'child-coverage.cjs'), CHILD_COVERAGE_SOURCE);
    // outside: the suite runs as `npm test` runs it, its tools found on the PATH npm gives a script — a spec that spawns oxlint type-aware leaves it to find tsgolint there.
    // Stryker disable next-line StringLiteral: a spec runs this command with the project's node_modules/.bin already first on the PATH, as npm does, so no spec can tell the folders apart
    process.env.PATH = `${join(project, 'node_modules', '.bin')}${delimiter}${process.env.PATH ?? ''}`;

    const modules = narrowed(tested, ranges);
    const first =
        modules.length === 0
            ? undefined
            : await measured(scope, { mutate: modules, name: 'modules' }, project);

    return await afterStage(first, async ({ ranByTests, report }) => {
        const measuredFiles = new Set(modules.map((range) => fileOf(range)));

        return await judgedAfterTheSuite({
            modulesRun: { measured: measuredFiles, ranByTests, report },
            project,
            ranges,
            scope,
            since,
            untested,
        });
    });
}
