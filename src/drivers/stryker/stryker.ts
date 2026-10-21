import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { delimiter, join } from 'node:path';
import process from 'node:process';

import { readSettings } from '../../../lint/index.rules.js';
import { ARTIFACTS, DEV_OUTPUT, MUTATION_OUTPUT } from '../../../lint/kit/project/build-plan.js';
import { withEnvironment } from '../../../lint/kit/project/environment.js';
import { git } from '../../../lint/kit/project/git.js';
import { objectOf, stringRecordOf } from '../../../lint/kit/project/json.js';
import { STAGES } from '../../../lint/kit/project/mutation-stages.js';
import type { StageName } from '../../../lint/kit/project/mutation-stages.js';
import { projectBinary } from '../../../lint/kit/project/package-root.js';
import { handOver } from '../run.js';
import { besideOf, withoutBesideLinks } from './beside.js';
import { headlessEnvironment } from './headless.js';
import { LOG_IGNORER, PINNED_TEXT_IGNORER } from './ignorers.js';
import { heldReport, mutatedLines, strykerMutate } from './mutate-entries.js';
import { killersLaid, PREVIOUS_KILLERS } from './previous-killers.js';
import { PROGRESS_REPORTER } from './progress-reporter.js';
import { linesIn, observedIn, recordFoldersMade, recordFoldersRemoved } from './record-folders.js';
import type { ObservedTest } from './record-folders.js';
import { sandboxScriptSource, vitestConfigSource } from './sources.js';

const oneGlob = (globs: readonly string[]): string =>
    globs.length === 1 ? String(globs) : `{${globs.join(',')}}`;

const typeCheckedGlob = (mutated: readonly string[]): string =>
    oneGlob(mutated.map((glob) => glob.replace('*.', '!(*.test-d).')));

export type Stage = {
    mutate: readonly string[];
    name: StageName;
};

/** The tool roots git ignores: trees a tool generates, as `expo run:ios` lays `ios/`, which no test reads and the sandbox must not copy. */
export function generatedRoots(project: string, toolRoots: readonly string[]): string[] {
    return toolRoots.filter(
        (root) => git(project, ['check-ignore', '--quiet', '--', root]) !== undefined,
    );
}

export const REPORTER_FILE = `${MUTATION_OUTPUT}/progress-reporter.mjs`;

/** The name the config gives the TypeScript checker, the plugin `#mutant-checker` declares. */
export const MUTANT_CHECKER = 'typescript-native';

const reportersOf = ({ html, terminal }: { html: boolean; terminal: boolean }): string[] => [
    ...(html ? ['html'] : []),
    'json',
    ...(terminal ? ['progress'] : []),
    PROGRESS_REPORTER,
    PREVIOUS_KILLERS.name,
];

export const IGNORERS_FILE = `${MUTATION_OUTPUT}/ignorers.mjs`;

const PLUGINS = [
    createRequire(import.meta.url).resolve('@stryker-mutator/vitest-runner'),
    createRequire(import.meta.url).resolve('#mutant-checker'),
    `./${REPORTER_FILE}`,
    `./${PREVIOUS_KILLERS.file}`,
    `./${IGNORERS_FILE}`,
];

export function strykerConfig(
    scope: {
        readonly generated: readonly string[];
        readonly mutated: readonly string[];
        readonly typeChecked: boolean;
    },
    { mutate, name }: Stage,
    {
        concurrency,
        html = false,
        terminal = process.stdout.isTTY,
        testFiles,
    }: {
        concurrency: number;
        html?: boolean;
        terminal?: boolean;
        testFiles?: readonly string[] | undefined;
    },
): object {
    const files = STAGES[name];
    const suite = name === 'suite';

    return {
        $schema: '../../node_modules/@stryker-mutator/core/schema/stryker-schema.json',
        buildCommand: `node ${MUTATION_OUTPUT}/${files.sandbox}`,
        checkers: scope.typeChecked ? [MUTANT_CHECKER] : [],
        concurrency,
        coverageAnalysis: 'perTest',
        disableTypeChecks: typeCheckedGlob(scope.mutated),
        ...(files.timeouts.dryRunMinutes === undefined
            ? {}
            : { dryRunTimeoutMinutes: files.timeouts.dryRunMinutes }),
        ...(html ? { htmlReporter: { fileName: `${MUTATION_OUTPUT}/${files.report}.html` } } : {}),
        ignorePatterns: [
            `/${ARTIFACTS}/**`,
            ...scope.generated.map((root) => `/${root}`),
            `!/${MUTATION_OUTPUT}/*.mjs`,
            `!/${MUTATION_OUTPUT}/*.cjs`,
            `!/${DEV_OUTPUT}/**`,
        ],
        ignoreStatic: true,
        ignorers: [LOG_IGNORER, PINNED_TEXT_IGNORER],
        incremental: true,
        incrementalFile: `${MUTATION_OUTPUT}/${files.incremental}.json`,
        jsonReporter: { fileName: `${MUTATION_OUTPUT}/${files.report}.json` },
        mutate: strykerMutate(mutate),
        plugins: PLUGINS,
        reporters: reportersOf({ html, terminal }),
        tempDirName: `${MUTATION_OUTPUT}/tmp`,
        ...(testFiles === undefined ? {} : { testFiles: strykerMutate(testFiles) }),
        testRunner: 'vitest',
        timeoutMS: files.timeouts.mutantMs,
        vitest: {
            configFile: `${MUTATION_OUTPUT}/${files.vitest}`,
            ...(suite ? { related: false } : {}),
        },
    };
}

function stageEnvironment(project: string): Readonly<Record<string, string>> {
    // outside: the suite runs as `npm test` runs it, its tools found on the PATH npm gives a script; a spec that spawns oxlint type-aware leaves it to find tsgolint there.
    // Stryker disable next-line StringLiteral: a spec runs this command with the project's node_modules/.bin already first on the PATH, as npm does, so no spec can tell the folders apart
    const path = `${join(project, 'node_modules', '.bin')}${delimiter}${process.env.PATH ?? ''}`;

    // Stryker disable next-line StringLiteral: the name only names the folder for a reader of .artifacts/; the openers it holds refuse from any folder put first on the PATH
    return headlessEnvironment(join(project, MUTATION_OUTPUT, 'headless'), path);
}

export type Measured = { ranByTests: ReadonlySet<string>; report: unknown };

/** What a stage ends on: what it measured, or Stryker's status when it failed. */
export type StageOutcome = Measured | { status: number };

/** What a stage that ended measured, beside what its tests' processes were seen to run. */
export type StageRan = Measured & { observed: readonly ObservedTest[] };

/** How a stage runs: whether the sandbox builds first, on how many test runners, whether it writes the HTML report a person asked for, in which project, and the test files its dry run is limited to, `undefined` for every one. */
export type StageRun = {
    buildsFirst: boolean;
    concurrency: number;
    html: boolean;
    project: string;
    testFiles: readonly string[] | undefined;
};

/** Whether a stage of `project` type-checks each mutant before its tests run it. */
export const typeCheckedIn = (project: string): boolean =>
    existsSync(join(project, 'tsconfig.json'));

// invariant: the TypeScript checker compiles the project from its tsconfig.json before the first mutant, and a mutant that does not compile is a CompileError no test runs; a project that keeps no tsconfig.json has no compilation to check a mutant against.
async function stageWritten(
    scope: { readonly exclude: readonly string[]; readonly mutated: readonly string[] },
    stage: Stage,
    {
        buildsFirst,
        concurrency,
        html,
        mutated,
        project,
        testFiles,
    }: {
        buildsFirst: boolean;
        concurrency: number;
        html: boolean;
        mutated: readonly string[];
        project: string;
        testFiles: readonly string[] | undefined;
    },
): Promise<void> {
    const files = STAGES[stage.name];
    const suite = stage.name === 'suite';
    const { resolved } = await readSettings(project);
    const toolRoots = Object.keys(stringRecordOf(objectOf(resolved.sections.typescript).toolRoots));
    const generated = generatedRoots(project, toolRoots);
    const typeChecked = typeCheckedIn(project);
    writeFileSync(
        join(project, MUTATION_OUTPUT, files.vitest),
        vitestConfigSource(
            { exclude: scope.exclude, mutated },
            suite ? { dryRunWorkers: concurrency, suite } : { suite },
        ),
    );
    writeFileSync(
        join(project, MUTATION_OUTPUT, files.sandbox),
        sandboxScriptSource(buildsFirst, project, besideOf(project)),
    );
    // invariant: a report a person asked for on an earlier run would read as this run's, so it goes before Stryker starts, which writes one again only where this run asks.
    rmSync(join(project, MUTATION_OUTPUT, `${files.report}.html`), { force: true });
    writeFileSync(
        join(project, MUTATION_OUTPUT, files.config),
        `${JSON.stringify(strykerConfig({ ...scope, generated, typeChecked }, stage, { concurrency, html, testFiles }), null, 4)}\n`,
    );
}

/** A stage's report and what its tests were seen to run, or Stryker's status when it failed: a failed run leaves no report this one could be judged by. */
export async function strykerRun(
    scope: { readonly exclude: readonly string[]; readonly mutated: readonly string[] },
    stage: Stage,
    { buildsFirst, concurrency, html, project, testFiles }: StageRun,
): Promise<StageRan | { status: number }> {
    const files = STAGES[stage.name];
    const folders = recordFoldersMade(project);
    const killers = killersLaid(project, files.report);
    await stageWritten(scope, stage, {
        buildsFirst,
        concurrency,
        html,
        mutated: [...mutatedLines(stage.mutate).keys()],
        project,
        testFiles,
    });
    const status = await withEnvironment(
        { ...stageEnvironment(project), ...killers },
        async () =>
            await withoutBesideLinks(
                project,
                besideOf(project),
                async () =>
                    await handOver(
                        projectBinary('stryker', project),
                        ['run', join(MUTATION_OUTPUT, files.config)],
                        project,
                    ),
            ),
    );
    const ranByTests = linesIn(folders.ranByTests);
    const observed = observedIn(folders.observed);
    recordFoldersRemoved(folders);

    if (status !== 0) {
        return { status };
    }
    const report = String(readFileSync(join(project, MUTATION_OUTPUT, `${files.report}.json`)));

    return { observed, ranByTests, report: heldReport(JSON.parse(report), stage.mutate) };
}
