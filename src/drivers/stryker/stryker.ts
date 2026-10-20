import { spawnSync } from 'node:child_process';
import {
    existsSync,
    lstatSync,
    mkdirSync,
    mkdtempSync,
    readdirSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { delimiter, dirname, join, relative, resolve, sep } from 'node:path';
import process from 'node:process';

import { readSettings } from '../../../lint/index.rules.js';
import { ARTIFACTS, DEV_OUTPUT, MUTATION_OUTPUT } from '../../../lint/kit/project/build-plan.js';
import { isList, objectOf, stringRecordOf } from '../../../lint/kit/project/json.js';
import { projectBinary } from '../../../lint/kit/project/package-root.js';
import { isRepositoryRoot, nearestRoot } from '../../../lint/kit/project/repository-root.js';
import { handOver } from '../run.js';
import { CHILD_COVERAGE_SOURCE } from './child-coverage.js';
import { headlessEnvironment } from './headless.js';
import { ignorersSource, LOG_IGNORER, PINNED_TEXT_IGNORER } from './ignorers.js';
import { incrementalKeptWhileInputsHold, recordInputs } from './incremental.js';
import type { StaysInFunctions } from './incremental.js';
import type { Inputs } from './inputs.js';
import {
    MUTANT_SETUP_SOURCE,
    OBSERVED_TESTS_VARIABLE,
    RAN_BY_TESTS_VARIABLE,
} from './mutant-setup.js';
import { heldReport, strykerMutate } from './mutate-entries.js';
import { observedFrom } from './observed.js';
import type { ObservedTest } from './observed.js';
import { PROGRESS_REPORTER, PROGRESS_REPORTER_SOURCE } from './progress-reporter.js';
import { REPORT_NAMES } from './reports.js';
import type { StageName } from './reports.js';
import { SANDBOX_DEPTH, sandboxScriptSource, vitestConfigSource } from './sources.js';
import type { Beside } from './sources.js';

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

const IGNORERS_FILE = `${MUTATION_OUTPUT}/ignorers.mjs`;

export function strykerConfig(
    scope: {
        readonly generated: readonly string[];
        readonly mutated: readonly string[];
        readonly typeChecked: boolean;
    },
    { mutate, name }: Stage,
    { concurrency, terminal = process.stdout.isTTY }: { concurrency: number; terminal?: boolean },
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

// invariant: a workspace member is mutated from its own folder, and its specs may climb out of it to the repository's files; a project that is the repository's own root has nothing above it to lay.
export function besideOf(project: string): Beside | undefined {
    const root = isRepositoryRoot(resolve(project))
        ? undefined
        : nearestRoot(dirname(resolve(project)), isRepositoryRoot);
    if (root === undefined) {
        return undefined;
    }

    return {
        levels: relative(root, resolve(project)).split(sep).length,
        names: readdirSync(root)
            .filter((name) => !name.startsWith('.') && name !== 'node_modules')
            .toSorted(),
        root,
    };
}

// invariant: the links a sandbox lays beside its copy outlive the run when they land in the member's own `.artifacts/`, and each points at a repository folder holding that `.artifacts/` again; a walker that follows links (ls-lint, in the Names pass) loops on them for ever, so the run takes them away when it ends, and before it starts, for those a killed run left.
export function besideLinksDropped(project: string, beside: Beside | undefined): void {
    if (beside === undefined || beside.levels < 1 || beside.levels >= SANDBOX_DEPTH) {
        return;
    }
    const laid = resolve(project, MUTATION_OUTPUT, 'tmp', 'sandbox', '../'.repeat(beside.levels));
    for (const name of beside.names) {
        const link = join(laid, name);
        if (lstatSync(link, { throwIfNoEntry: false })?.isSymbolicLink() === true) {
            rmSync(link);
        }
    }
}

/** Runs `run` with the links of the sandbox gone before it starts, for those a killed run left, and after it ends. */
export async function withoutBesideLinks<T>(
    project: string,
    beside: Beside | undefined,
    run: () => Promise<T>,
): Promise<T> {
    besideLinksDropped(project, beside);
    const result = await run();
    besideLinksDropped(project, beside);

    return result;
}

/** Keeps of the stage's incremental report what the change since its run leaves standing, none of it when the run starts cold, and returns the inputs the stage starts on. */
export const reportKept = (
    project: string,
    stage: Stage,
    kept: { cold: boolean; staysInFunctions: StaysInFunctions },
): Inputs | undefined =>
    incrementalKeptWhileInputsHold(project, FILES[stage.name].incremental, kept);

const sourcesListed = (sources: unknown): string[] | undefined =>
    isList(sources) ? sources.map(String) : undefined;

function observedTestOf(value: unknown): ObservedTest {
    const { loaded, ran, test } = objectOf(value);

    return { loaded: sourcesListed(loaded), ran: sourcesListed(ran), test: String(test) };
}

function observedIn(folder: string): ObservedTest[] {
    return readdirSync(folder).flatMap((name) => {
        const text = String(readFileSync(join(folder, name)));
        const records: unknown = JSON.parse(text);

        return isList(records) ? records.map(observedTestOf) : [];
    });
}

export type Measured = { ranByTests: ReadonlySet<string>; report: unknown };

/** How a stage runs: whether the sandbox builds first, from no report, on how many test runners, in which project. */
export type StageRun = {
    buildsFirst: boolean;
    cold: boolean;
    concurrency: number;
    project: string;
    staysInFunctions: StaysInFunctions;
};

/** A stage's report, or Stryker's status when it failed: a failed run leaves no report this one could be judged by. */
export async function strykerRun(
    scope: { readonly exclude: readonly string[]; readonly mutated: readonly string[] },
    stage: Stage,
    run: StageRun,
): Promise<Measured | { status: number }> {
    const { buildsFirst, cold, concurrency, project, staysInFunctions } = run;
    const files = FILES[stage.name];
    const suite = stage.name === 'suite';
    const { resolved } = await readSettings(project);
    const toolRoots = Object.keys(stringRecordOf(objectOf(resolved.sections.typescript).toolRoots));
    const generated = generatedRoots(project, toolRoots);
    // invariant: Stryker's TypeScript checker compiles the project from its tsconfig.json before the first mutant, and a mutant that does not compile is a CompileError no test runs; a project that keeps no tsconfig.json has no compilation to check a mutant against.
    const typeChecked = existsSync(join(project, 'tsconfig.json'));
    writeFileSync(join(MUTATION_OUTPUT, files.vitest), vitestConfigSource(scope.exclude, suite));
    writeFileSync(
        join(MUTATION_OUTPUT, files.sandbox),
        sandboxScriptSource(buildsFirst, project, besideOf(project)),
    );
    writeFileSync(
        join(MUTATION_OUTPUT, files.config),
        `${JSON.stringify(strykerConfig({ ...scope, generated, typeChecked }, stage, { concurrency }), null, 4)}\n`,
    );
    // Stryker disable next-line StringLiteral: the prefix only names the folder for a reader of .artifacts/
    const ranInto = mkdtempSync(join(project, MUTATION_OUTPUT, 'ran-by-tests-'));
    // Stryker disable next-line StringLiteral: the prefix only names the folder for a reader of .artifacts/
    const observedInto = mkdtempSync(join(project, MUTATION_OUTPUT, 'observed-tests-'));
    process.env[RAN_BY_TESTS_VARIABLE] = ranInto;
    process.env[OBSERVED_TESTS_VARIABLE] = observedInto;
    const inputs = reportKept(project, stage, { cold, staysInFunctions });
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
    const ranByTests = new Set(
        readdirSync(ranInto).flatMap((name) =>
            String(readFileSync(join(ranInto, name))).split('\n'),
        ),
    );
    const observed = observedFrom(observedIn(observedInto), inputs);
    rmSync(ranInto, { recursive: true });
    rmSync(observedInto, { recursive: true });

    if (status !== 0) {
        return { status };
    }
    recordInputs(project, files.incremental, { inputs: inputs ?? {}, observed });
    const report = String(readFileSync(join(MUTATION_OUTPUT, `${files.report}.json`)));

    return { ranByTests, report: heldReport(JSON.parse(report), stage.mutate) };
}
