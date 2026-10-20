import { spawnSync } from 'node:child_process';
import {
    existsSync,
    mkdirSync,
    mkdtempSync,
    readdirSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { delimiter, join } from 'node:path';
import process from 'node:process';

import { readSettings } from '../../../lint/index.rules.js';
import { ARTIFACTS, DEV_OUTPUT, MUTATION_OUTPUT } from '../../../lint/kit/project/build-plan.js';
import { objectOf, stringRecordOf } from '../../../lint/kit/project/json.js';
import { projectBinary } from '../../../lint/kit/project/package-root.js';
import { handOver } from '../run.js';
import { besideOf, withoutBesideLinks } from './beside.js';
import { CHILD_COVERAGE_SOURCE } from './child-coverage.js';
import { headlessEnvironment } from './headless.js';
import { ignorersSource, LOG_IGNORER, PINNED_TEXT_IGNORER } from './ignorers.js';
import { incrementalKeptWhileInputsHold, recordInputs } from './incremental.js';
import type { DryRunOver, Kept, LinesInFunctions, StaysInFunctions } from './incremental.js';
import {
    MUTANT_SETUP_SOURCE,
    OBSERVED_TESTS_VARIABLE,
    RAN_BY_TESTS_VARIABLE,
} from './mutant-setup.js';
import { heldReport, mutatedLines, strykerMutate } from './mutate-entries.js';
import { observedFrom, observedIn } from './observed.js';
import { PROGRESS_REPORTER, PROGRESS_REPORTER_SOURCE } from './progress-reporter.js';
import { REPORT_NAMES } from './reports.js';
import type { StageName } from './reports.js';
import { sandboxScriptSource, vitestConfigSource } from './sources.js';

const oneGlob = (globs: readonly string[]): string =>
    globs.length === 1 ? String(globs) : `{${globs.join(',')}}`;

const typeCheckedGlob = (mutated: readonly string[]): string =>
    oneGlob(mutated.map((glob) => glob.replace('*.', '!(*.test-d).')));

export type Stage = {
    mutate: readonly string[];
    name: StageName;
};

const FILES = {
    modules: {
        config: 'stryker.config.json',
        incremental: 'incremental',
        report: REPORT_NAMES.modules,
        sandbox: 'sandbox.mjs',
        vitest: 'vitest.config.mjs',
    },
    suite: {
        config: 'stryker.suite.config.json',
        incremental: 'suite-incremental',
        report: REPORT_NAMES.suite,
        sandbox: 'sandbox.suite.mjs',
        vitest: 'vitest.suite.config.mjs',
    },
} as const;

/** The tool roots git ignores: trees a tool generates, as `expo run:ios` lays `ios/`, which no test reads and the sandbox must not copy. */
export function generatedRoots(project: string, toolRoots: readonly string[]): string[] {
    return toolRoots.filter(
        (root) =>
            spawnSync('git', ['check-ignore', '--quiet', '--', root], { cwd: project }).status ===
            0,
    );
}

const REPORTER_FILE = `${MUTATION_OUTPUT}/progress-reporter.mjs`;

export const IGNORERS_FILE = `${MUTATION_OUTPUT}/ignorers.mjs`;

export function strykerConfig(
    scope: {
        readonly generated: readonly string[];
        readonly mutated: readonly string[];
        readonly typeChecked: boolean;
    },
    { mutate, name }: Stage,
    {
        concurrency,
        terminal = process.stdout.isTTY,
        testFiles,
    }: { concurrency: number; terminal?: boolean; testFiles?: readonly string[] | undefined },
): object {
    const files = FILES[name];
    const suite = name === 'suite';

    return {
        $schema: '../../node_modules/@stryker-mutator/core/schema/stryker-schema.json',
        buildCommand: `node ${MUTATION_OUTPUT}/${files.sandbox}`,
        checkers: scope.typeChecked ? ['typescript'] : [],
        concurrency,
        coverageAnalysis: 'perTest',
        disableTypeChecks: typeCheckedGlob(scope.mutated),
        ...(suite ? { dryRunTimeoutMinutes: 60 } : {}),
        htmlReporter: { fileName: `${MUTATION_OUTPUT}/${files.report}.html` },
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
        plugins: [
            createRequire(import.meta.url).resolve('@stryker-mutator/vitest-runner'),
            createRequire(import.meta.url).resolve('@stryker-mutator/typescript-checker'),
            `./${REPORTER_FILE}`,
            `./${IGNORERS_FILE}`,
        ],
        reporters: ['html', 'json', ...(terminal ? ['progress'] : []), PROGRESS_REPORTER],
        tempDirName: `${MUTATION_OUTPUT}/tmp`,
        ...(testFiles === undefined ? {} : { testFiles: strykerMutate(testFiles) }),
        testRunner: 'vitest',
        timeoutMS: suite ? 60_000 : 30_000,
        vitest: {
            configFile: `${MUTATION_OUTPUT}/${files.vitest}`,
            ...(suite ? { related: false } : {}),
        },
    };
}

/** Lays the files every stage of the run loads, the presentation globs its ignorers read among them, and the PATH its suite runs under, a browser out of its reach. */
export function strykerPrepared(project: string, presentation: readonly string[]): void {
    mkdirSync(MUTATION_OUTPUT, { recursive: true });
    writeFileSync(join(MUTATION_OUTPUT, 'mutant-setup.mjs'), MUTANT_SETUP_SOURCE);
    writeFileSync(join(MUTATION_OUTPUT, 'child-coverage.cjs'), CHILD_COVERAGE_SOURCE);
    writeFileSync(REPORTER_FILE, PROGRESS_REPORTER_SOURCE);
    writeFileSync(IGNORERS_FILE, ignorersSource(presentation));
    // outside: the suite runs as `npm test` runs it, its tools found on the PATH npm gives a script; a spec that spawns oxlint type-aware leaves it to find tsgolint there.
    // Stryker disable next-line StringLiteral: a spec runs this command with the project's node_modules/.bin already first on the PATH, as npm does, so no spec can tell the folders apart
    process.env.PATH = `${join(project, 'node_modules', '.bin')}${delimiter}${process.env.PATH ?? ''}`;
    Object.assign(
        process.env,
        // Stryker disable next-line StringLiteral: the name only names the folder for a reader of .artifacts/; the openers it holds refuse from any folder put first on the PATH
        headlessEnvironment(join(project, MUTATION_OUTPUT, 'headless'), process.env.PATH),
    );
}

/** Keeps of the stage's incremental report what the change since its run leaves standing, none of it when the run starts cold, and returns what the stage starts on. */
export const reportKept = (
    project: string,
    stage: Stage,
    kept: {
        cold: boolean;
        dryRunOver?: DryRunOver | undefined;
        staysInFunctions: StaysInFunctions;
    },
): Kept => incrementalKeptWhileInputsHold(project, FILES[stage.name].incremental, kept);

export type Measured = { ranByTests: ReadonlySet<string>; report: unknown };

/** What the suite's dry run runs before its first mutant: the test files it keeps of those the record knows, `undefined` for every one, on how many workers. */
export type DryRunScope = {
    files: undefined | { kept: number; known: number };
    workers: number;
};

/** How a stage runs: whether the sandbox builds first, from no report, on how many test runners, in which project, how a change and a mutated line are read, and who hears what the suite's dry run runs. */
export type StageRun = {
    buildsFirst: boolean;
    cold: boolean;
    concurrency: number;
    dryRunScoped: (scope: DryRunScope) => void;
    linesInFunctions: LinesInFunctions;
    project: string;
    staysInFunctions: StaysInFunctions;
};

const ranByTestsIn = (folder: string): Set<string> =>
    new Set(
        readdirSync(folder).flatMap((name) => String(readFileSync(join(folder, name))).split('\n')),
    );

/** Whether a stage of `project` type-checks each mutant before its tests run it. */
export const typeCheckedIn = (project: string): boolean =>
    existsSync(join(project, 'tsconfig.json'));

// invariant: Stryker's TypeScript checker compiles the project from its tsconfig.json before the first mutant, and a mutant that does not compile is a CompileError no test runs; a project that keeps no tsconfig.json has no compilation to check a mutant against.
async function stageWritten(
    scope: { readonly exclude: readonly string[]; readonly mutated: readonly string[] },
    stage: Stage,
    {
        buildsFirst,
        concurrency,
        mutated,
        project,
        testFiles,
    }: {
        buildsFirst: boolean;
        concurrency: number;
        mutated: readonly string[];
        project: string;
        testFiles: readonly string[] | undefined;
    },
): Promise<void> {
    const files = FILES[stage.name];
    const suite = stage.name === 'suite';
    const { resolved } = await readSettings(project);
    const toolRoots = Object.keys(stringRecordOf(objectOf(resolved.sections.typescript).toolRoots));
    const generated = generatedRoots(project, toolRoots);
    const typeChecked = typeCheckedIn(project);
    writeFileSync(
        join(MUTATION_OUTPUT, files.vitest),
        vitestConfigSource(
            { exclude: scope.exclude, mutated },
            suite ? { dryRunWorkers: concurrency, suite } : { suite },
        ),
    );
    writeFileSync(
        join(MUTATION_OUTPUT, files.sandbox),
        sandboxScriptSource(buildsFirst, project, besideOf(project)),
    );
    writeFileSync(
        join(MUTATION_OUTPUT, files.config),
        `${JSON.stringify(strykerConfig({ ...scope, generated, typeChecked }, stage, { concurrency, testFiles }), null, 4)}\n`,
    );
}

/** A stage's report, or Stryker's status when it failed: a failed run leaves no report this one could be judged by. */
export async function strykerRun(
    scope: { readonly exclude: readonly string[]; readonly mutated: readonly string[] },
    stage: Stage,
    run: StageRun,
): Promise<Measured | { status: number }> {
    const { buildsFirst, cold, concurrency, linesInFunctions, project } = run;
    const files = FILES[stage.name];
    const suite = stage.name === 'suite';
    const lines = mutatedLines(stage.mutate);
    // Stryker disable next-line StringLiteral: the prefix only names the folder for a reader of .artifacts/
    const ranInto = mkdtempSync(join(project, MUTATION_OUTPUT, 'ran-by-tests-'));
    // Stryker disable next-line StringLiteral: the prefix only names the folder for a reader of .artifacts/
    const observedInto = mkdtempSync(join(project, MUTATION_OUTPUT, 'observed-tests-'));
    process.env[RAN_BY_TESTS_VARIABLE] = ranInto;
    process.env[OBSERVED_TESTS_VARIABLE] = observedInto;
    const { carried, dryRun, inputs } = reportKept(project, stage, {
        cold,
        dryRunOver: suite ? { lines, linesInFunctions } : undefined,
        staysInFunctions: run.staysInFunctions,
    });
    await stageWritten(scope, stage, {
        buildsFirst,
        concurrency,
        mutated: [...lines.keys()],
        project,
        testFiles: dryRun?.kept,
    });
    if (suite) {
        run.dryRunScoped({
            files: dryRun && { kept: dryRun.kept.length, known: dryRun.known },
            workers: concurrency,
        });
    }
    const status = await withoutBesideLinks(
        project,
        besideOf(project),
        async () =>
            await handOver(
                projectBinary('stryker'),
                ['run', join(MUTATION_OUTPUT, files.config)],
                project,
            ),
    );
    const ranByTests = ranByTestsIn(ranInto);
    // invariant: a test file the dry run left out holds no test the change made stale, so what the last record says of its tests still holds and is carried into this one.
    const observed = observedFrom([...observedIn(observedInto), ...carried], inputs);
    rmSync(ranInto, { recursive: true });
    rmSync(observedInto, { recursive: true });

    if (status !== 0) {
        return { status };
    }
    recordInputs(project, files.incremental, { inputs: inputs ?? {}, observed });
    const report = String(readFileSync(join(MUTATION_OUTPUT, `${files.report}.json`)));

    return { ranByTests, report: heldReport(JSON.parse(report), stage.mutate) };
}
