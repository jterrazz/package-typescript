import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { delimiter, join } from 'node:path';
import process from 'node:process';

import { ARTIFACTS, DEV_OUTPUT, MUTATION_OUTPUT } from '../../../lint/kit/project/build-plan.js';
import { projectBinary } from '../../../lint/kit/project/package-root.js';
import { handOver } from '../run.js';
import {
    CHILD_COVERAGE_SOURCE,
    MUTANT_SETUP_SOURCE,
    RAN_BY_TESTS_VARIABLE,
    sandboxScriptSource,
    vitestConfigSource,
} from './sources.js';

const oneGlob = (globs: readonly string[]): string =>
    globs.length === 1 ? String(globs) : `{${globs.join(',')}}`;

const typeCheckedGlob = (mutated: readonly string[]): string =>
    oneGlob(mutated.map((glob) => glob.replace('*.', '!(*.test-d).')));

export type Stage = {
    mutate: readonly string[];
    name: 'modules' | 'suite';
};

const FILES = {
    modules: {
        config: 'stryker.config.json',
        incremental: 'incremental',
        report: 'report',
        sandbox: 'sandbox.mjs',
        vitest: 'vitest.config.mjs',
    },
    suite: {
        config: 'stryker.suite.config.json',
        incremental: 'suite-incremental',
        report: 'suite-report',
        sandbox: 'sandbox.suite.mjs',
        vitest: 'vitest.suite.config.mjs',
    },
} as const;

export function strykerConfig(
    scope: { readonly mutated: readonly string[] },
    { mutate, name }: Stage,
): object {
    const files = FILES[name];
    const suite = name === 'suite';

    return {
        $schema: '../../node_modules/@stryker-mutator/core/schema/stryker-schema.json',
        buildCommand: `node ${MUTATION_OUTPUT}/${files.sandbox}`,
        checkers: [],
        concurrency: suite ? 6 : 8,
        coverageAnalysis: 'perTest',
        disableTypeChecks: typeCheckedGlob(scope.mutated),
        ...(suite ? { dryRunTimeoutMinutes: 60 } : {}),
        htmlReporter: { fileName: `${MUTATION_OUTPUT}/${files.report}.html` },
        ignorePatterns: [
            `/${ARTIFACTS}/**`,
            `!/${MUTATION_OUTPUT}/*.mjs`,
            `!/${MUTATION_OUTPUT}/*.cjs`,
            `!/${DEV_OUTPUT}/**`,
        ],
        ignoreStatic: true,
        incremental: true,
        incrementalFile: `${MUTATION_OUTPUT}/${files.incremental}.json`,
        jsonReporter: { fileName: `${MUTATION_OUTPUT}/${files.report}.json` },
        mutate,
        plugins: [createRequire(import.meta.url).resolve('@stryker-mutator/vitest-runner')],
        reporters: ['clear-text', 'html', 'json', 'progress'],
        tempDirName: `${MUTATION_OUTPUT}/tmp`,
        testRunner: 'vitest',
        timeoutMS: suite ? 60_000 : 30_000,
        vitest: {
            configFile: `${MUTATION_OUTPUT}/${files.vitest}`,
            ...(suite ? { related: false } : {}),
        },
    };
}

/** Lays the files every stage of the run loads, and the PATH its suite runs under. */
export function strykerPrepared(project: string): void {
    mkdirSync(MUTATION_OUTPUT, { recursive: true });
    writeFileSync(join(MUTATION_OUTPUT, 'mutant-setup.mjs'), MUTANT_SETUP_SOURCE);
    writeFileSync(join(MUTATION_OUTPUT, 'child-coverage.cjs'), CHILD_COVERAGE_SOURCE);
    // outside: the suite runs as `npm test` runs it, its tools found on the PATH npm gives a script — a spec that spawns oxlint type-aware leaves it to find tsgolint there.
    // Stryker disable next-line StringLiteral: a spec runs this command with the project's node_modules/.bin already first on the PATH, as npm does, so no spec can tell the folders apart
    process.env.PATH = `${join(project, 'node_modules', '.bin')}${delimiter}${process.env.PATH ?? ''}`;
}

export type Measured = { ranByTests: ReadonlySet<string>; report: unknown };

/** A stage's report, or Stryker's status when it failed: a failed run leaves no report this one could be judged by. */
export async function strykerRun(
    scope: { readonly exclude: readonly string[]; readonly mutated: readonly string[] },
    stage: Stage,
    { buildsFirst, project }: { buildsFirst: boolean; project: string },
): Promise<Measured | { status: number }> {
    const files = FILES[stage.name];
    const suite = stage.name === 'suite';
    writeFileSync(join(MUTATION_OUTPUT, files.vitest), vitestConfigSource(scope.exclude, suite));
    writeFileSync(join(MUTATION_OUTPUT, files.sandbox), sandboxScriptSource(suite && buildsFirst));
    writeFileSync(
        join(MUTATION_OUTPUT, files.config),
        `${JSON.stringify(strykerConfig(scope, stage), null, 4)}\n`,
    );
    // Stryker disable next-line StringLiteral: the prefix only names the folder for a reader of .artifacts/
    const ranInto = mkdtempSync(join(project, MUTATION_OUTPUT, 'ran-by-tests-'));
    process.env[RAN_BY_TESTS_VARIABLE] = ranInto;
    const status = await handOver(
        projectBinary('stryker'),
        ['run', join(MUTATION_OUTPUT, files.config)],
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
    const report = String(readFileSync(join(MUTATION_OUTPUT, `${files.report}.json`)));

    return { ranByTests, report: JSON.parse(report) };
}
