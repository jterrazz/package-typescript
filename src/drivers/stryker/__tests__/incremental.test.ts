import { execFileSync } from 'node:child_process';
import {
    existsSync,
    mkdirSync,
    mkdtempSync,
    readdirSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';

import { isList, objectOf, parsedObject } from '../../../../lint/kit/project/json.js';
import { diffStaysInFunctions, linesStayInFunctions } from '../../tsc/change-shape.js';
import { incrementalKeptWhileInputsHold, recordInputs } from '../incremental.js';
import { observedFrom } from '../observed.js';
import type { ObservedTest } from '../observed.js';
import { reportKept } from '../stryker.js';
import { FILES, MODULE_TESTS, REPORT, SPEC_QUIET, SPEC_RAN_A } from './incremental.fixtures.js';

const startedIn = (root: string, cold = false) =>
    incrementalKeptWhileInputsHold(root, 'suite-incremental', {
        cold,
        staysInFunctions: diffStaysInFunctions,
    }).inputs;

const roots: string[] = [];

function projectWith(files: Record<string, string>): string {
    const root = mkdtempSync(join(tmpdir(), 'incremental-'));
    roots.push(root);
    execFileSync('git', ['init', '--quiet'], { cwd: root });
    for (const [path, text] of Object.entries(files)) {
        mkdirSync(join(root, path, '..'), { recursive: true });
        writeFileSync(join(root, path), text);
    }
    mkdirSync(join(root, '.artifacts/stryker'), { recursive: true });

    return root;
}

afterEach(() => {
    for (const root of roots.splice(0)) {
        rmSync(root, { force: true, recursive: true });
    }
});

const idOf = (one: unknown): string => String(objectOf(one).id);

function idsByFile(report: unknown): Record<string, string[]> {
    const files = Object.entries(objectOf(objectOf(report).files));

    return Object.fromEntries(
        files.map(([file, entry]) => {
            const { mutants } = objectOf(entry);

            return [file, isList(mutants) ? mutants.map(idOf) : []];
        }),
    );
}

const parsedAt = (path: string): Record<string, unknown> =>
    parsedObject(readFileSync(path, 'utf8'));

const reportOf = (root: string): string => join(root, '.artifacts/stryker/suite-incremental.json');

const recordOf = (root: string): Record<string, unknown> =>
    parsedAt(join(root, '.artifacts/stryker/suite-incremental.inputs.json'));

const keptIn = (root: string): Record<string, string[]> => idsByFile(parsedAt(reportOf(root)));

function ranOnce(
    observed: readonly ObservedTest[] = MODULE_TESTS,
    files: Record<string, string> = FILES,
): string {
    const root = projectWith(files);
    const inputs = startedIn(root) ?? {};
    writeFileSync(reportOf(root), JSON.stringify(REPORT));
    recordInputs(root, 'suite-incremental', { inputs, observed: observedFrom(observed) });

    return root;
}

describe('incremental', () => {
    test('incrementalKeptWhileInputsHold — a run on the inputs its report was written on keeps the report whole, and records them again with no test followed yet', () => {
        // Given - a run that ended, its module tests seen spawning nothing
        const root = ranOnce();

        // When - a run starts on the same tree
        startedIn(root);

        // Then - the report stands, and the record follows no test until this run ends
        expect(parsedAt(reportOf(root))).toStrictEqual(REPORT);
        expect(objectOf(recordOf(root).inputs)['src/a.ts']).toStrictEqual(expect.any(String));
        expect(recordOf(root)).not.toHaveProperty('observed');
    });

    test('incrementalKeptWhileInputsHold — a changed helper takes out the mutants of the tests that load it', () => {
        // Given - a run that ended
        const root = ranOnce();

        // When - the helper changes and a run starts
        writeFileSync(join(root, 'src/h.ts'), 'changed');
        startedIn(root);

        // Then - b's mutant is measured again, a's go with the spec the run never followed
        expect(keptIn(root)).toStrictEqual({ 'src/a.ts': [], 'src/b.ts': [] });
    });

    test('incrementalKeptWhileInputsHold — a change inside a function of a source the spec only loaded keeps the spec’s mutants and leaves the spec out of a dry run mutating it, a change to what loads does not', () => {
        // Given - a run that ended, its spec's processes seen running a.ts and loading h.ts
        const body = ranOnce(SPEC_RAN_A);
        const loading = ranOnce(SPEC_RAN_A);

        // When - h's function changes in one tree, its constant in the other, and a run starts in each
        writeFileSync(
            join(body, 'src/h.ts'),
            FILES['src/h.ts'].replace('return H;', 'return H + 1;'),
        );
        writeFileSync(join(loading, 'src/h.ts'), FILES['src/h.ts'].replace('H = 1', 'H = 2'));
        const { carried, dryRun } = incrementalKeptWhileInputsHold(body, 'suite-incremental', {
            cold: false,
            dryRunOver: {
                lines: new Map([['src/h.ts', [4]]]),
                linesInFunctions: linesStayInFunctions,
            },
            staysInFunctions: diffStaysInFunctions,
        });
        startedIn(loading);

        // Then - the function's change measures again b's mutant alone, the constant's the spec's too; the texts kept are this run's
        expect([keptIn(body), keptIn(loading)]).toStrictEqual([
            { 'src/a.ts': ['1', '2'], 'src/b.ts': [] },
            { 'src/a.ts': [], 'src/b.ts': [] },
        ]);
        expect(
            readdirSync(join(body, '.artifacts/stryker/suite-incremental.sources')),
        ).toHaveLength(3);
        // Then - a dry run mutating the changed line runs the module test that loads h.ts alone, and carries what the record saw of the two left out
        expect({ carried, dryRun }).toStrictEqual({
            carried: [MODULE_TESTS[0], SPEC_RAN_A[2]],
            dryRun: { kept: ['src/__tests__/b.test.ts'], known: 3 },
        });
    });

    test('incrementalKeptWhileInputsHold — a source the dry run mutates whole keeps the spec that only loaded it, and a deleted test file is carried by no dry run', () => {
        // Given - a run that ended, its spec's processes seen running a.ts and loading h.ts
        const root = ranOnce(SPEC_RAN_A);

        // When - h's function changes, a's module test is deleted, and a dry run mutates h.ts whole, by a reading of lines that would call them all in functions
        writeFileSync(
            join(root, 'src/h.ts'),
            FILES['src/h.ts'].replace('return H;', 'return H + 1;'),
        );
        rmSync(join(root, 'src/__tests__/a.test.ts'));
        const { carried, dryRun } = incrementalKeptWhileInputsHold(root, 'suite-incremental', {
            cold: false,
            dryRunOver: {
                lines: new Map([['src/h.ts', undefined]]),
                linesInFunctions: () => true,
            },
            staysInFunctions: diffStaysInFunctions,
        });

        // Then - the spec runs beside the module test that loads h.ts, and nothing of the deleted file is carried
        expect({ carried, dryRun }).toStrictEqual({
            carried: [],
            dryRun: { kept: ['specs/a.spec.ts', 'src/__tests__/b.test.ts'], known: 2 },
        });
    });

    test('incrementalKeptWhileInputsHold — a dry run the change cannot limit carries nothing of the record', () => {
        // Given - a run that ended, its spec's processes seen running a.ts and loading h.ts
        const root = ranOnce(SPEC_RAN_A);

        // When - the manifest changes, and a dry run mutates a line of h's function
        writeFileSync(join(root, 'package.json'), '{"name":"@scope/renamed"}');
        const { carried, dryRun } = incrementalKeptWhileInputsHold(root, 'suite-incremental', {
            cold: false,
            dryRunOver: {
                lines: new Map([['src/h.ts', [4]]]),
                linesInFunctions: linesStayInFunctions,
            },
            staysInFunctions: diffStaysInFunctions,
        });

        // Then - every file runs, so every test's record is this run's to write
        expect({ carried, dryRun }).toStrictEqual({ carried: [], dryRun: undefined });
    });

    test('incrementalKeptWhileInputsHold — a source whose earlier text was never kept reads as changed as it loads', () => {
        // Given - a run that ended on the spec's processes loading h.ts, its kept texts then lost
        const root = ranOnce(SPEC_RAN_A);
        rmSync(join(root, '.artifacts/stryker/suite-incremental.sources'), { recursive: true });

        // When - h's function changes, and a run starts
        writeFileSync(
            join(root, 'src/h.ts'),
            FILES['src/h.ts'].replace('return H;', 'return H + 1;'),
        );
        startedIn(root);

        // Then - the spec's mutants are measured again with b's
        expect(keptIn(root)).toStrictEqual({ 'src/a.ts': [], 'src/b.ts': [] });
    });

    test('incrementalKeptWhileInputsHold — a source a test loads through a setup helper reaches the test', () => {
        // Given - a run that ended, every test seen spawning nothing, b's module test loading b through a helper of specs/__setup__/
        const root = ranOnce(SPEC_QUIET, {
            ...FILES,
            'specs/__setup__/helper.ts': "export { b } from '../../src/b.js';",
            'src/__tests__/b.test.ts': "import { b } from '../../specs/__setup__/helper.js';",
        });

        // When - h.ts, which b imports, changes, and a run starts
        writeFileSync(join(root, 'src/h.ts'), 'changed');
        startedIn(root);

        // Then - b's mutant is measured again, a's stay
        expect(keptIn(root)).toStrictEqual({ 'src/a.ts': ['1', '2'], 'src/b.ts': [] });
    });

    test('incrementalKeptWhileInputsHold — a run after one that never ended follows no test', () => {
        // Given - a run that started on the tree and never ended
        const root = ranOnce();
        startedIn(root);

        // When - a source no test imports appears, and a run starts
        writeFileSync(join(root, 'src/c.ts'), 'new');
        startedIn(root);

        // Then - every covered mutant is measured again
        expect(keptIn(root)).toStrictEqual({ 'src/a.ts': [], 'src/b.ts': [] });
    });

    test.each([
        ['a cold start', { cold: true }],
        ['a run with no record of its inputs', { record: 'absent' }],
        ['a record that does not parse', { record: 'not json' }],
        ['a report that does not parse', { report: 'not json' }],
    ])(
        'incrementalKeptWhileInputsHold — %s drops the report',
        (_case, broken: { cold?: boolean; record?: string; report?: string }) => {
            // Given - a run that ended, then broken as the case says
            const root = ranOnce();
            const record = join(root, '.artifacts/stryker/suite-incremental.inputs.json');
            if (broken.record === 'absent') {
                rmSync(record);
            } else if (broken.record !== undefined) {
                writeFileSync(record, broken.record);
            }
            if (broken.report !== undefined) {
                writeFileSync(reportOf(root), broken.report);
            }

            // When - a run starts
            startedIn(root, broken.cold === true);

            // Then - no report, and the inputs recorded for the next run
            expect(existsSync(reportOf(root))).toBe(false);
            expect(objectOf(recordOf(root).inputs)['src/h.ts']).toStrictEqual(expect.any(String));
        },
    );

    test('incrementalKeptWhileInputsHold — a project git cannot list drops the report and its record, so no change goes untold', () => {
        // Given - a run that ended, then the repository gone from under it
        const root = ranOnce();
        rmSync(join(root, '.git'), { force: true, recursive: true });

        // When - a run starts
        const inputs = startedIn(root);

        // Then - no inputs, no report, no record
        expect([
            inputs,
            existsSync(reportOf(root)),
            existsSync(join(root, '.artifacts/stryker/suite-incremental.inputs.json')),
        ]).toStrictEqual([undefined, false, false]);
    });

    test('incrementalKeptWhileInputsHold — a root config that changed drops the report', () => {
        // Given - a run that ended
        const root = ranOnce();

        // When - the package's manifest changes
        writeFileSync(join(root, 'package.json'), '{"name":"@scope/renamed"}');
        startedIn(root);

        // Then - the report is gone
        expect(existsSync(reportOf(root))).toBe(false);
    });

    test('reportKept — each stage keeps its own report, and a cold start drops its own', () => {
        // Given - both stages' reports written on the tree as it stands
        const root = projectWith(FILES);
        const suite = { mutate: [], name: 'suite' } as const;
        const modules = { mutate: [], name: 'modules' } as const;
        const suiteReport = join(root, '.artifacts/stryker/suite-incremental.json');
        const modulesReport = join(root, '.artifacts/stryker/incremental.json');
        recordInputs(root, 'suite-incremental', {
            inputs:
                reportKept(root, suite, { cold: false, staysInFunctions: diffStaysInFunctions })
                    .inputs ?? {},
            observed: observedFrom([]),
        });
        recordInputs(root, 'incremental', {
            inputs:
                reportKept(root, modules, {
                    cold: false,
                    staysInFunctions: diffStaysInFunctions,
                }).inputs ?? {},
            observed: observedFrom([]),
        });
        writeFileSync(suiteReport, '{}');
        writeFileSync(modulesReport, '{}');

        // When - a warm start of each, then a cold one of each
        reportKept(root, suite, { cold: false, staysInFunctions: diffStaysInFunctions });
        reportKept(root, modules, { cold: false, staysInFunctions: diffStaysInFunctions });
        const warm = [existsSync(suiteReport), existsSync(modulesReport)];
        reportKept(root, modules, { cold: true, staysInFunctions: diffStaysInFunctions });
        const afterModules = [existsSync(suiteReport), existsSync(modulesReport)];
        reportKept(root, suite, { cold: true, staysInFunctions: diffStaysInFunctions });

        // Then - warm keeps both, each cold start drops its own stage's
        expect([
            warm,
            afterModules,
            [existsSync(suiteReport), existsSync(modulesReport)],
        ]).toStrictEqual([
            [true, true],
            [true, false],
            [false, false],
        ]);
    });

    test.each([
        [
            'a module test importing the package by its name reads every source',
            FILES,
            { 'src/a.ts': ['2'], 'src/b.ts': [] },
        ],
        [
            'a project with no manifest names no package of its own',
            { ...FILES, 'package.json': undefined },
            { 'src/a.ts': ['1', '2'], 'src/b.ts': [] },
        ],
    ])('incrementalKeptWhileInputsHold — %s', (_case, files, kept) => {
        // Given - a run that ended, every test seen spawning nothing, a's module test importing the package by its name
        const laid = Object.fromEntries(
            Object.entries({
                ...files,
                'src/__tests__/a.test.ts': "import { a } from '@scope/package';",
            }).filter((entry): entry is [string, string] => entry[1] !== undefined),
        );
        const root = ranOnce(SPEC_QUIET, laid);

        // When - h.ts, which a's test never imports by path, changes
        writeFileSync(join(root, 'src/h.ts'), 'changed');
        startedIn(root);

        // Then - a's mutant goes only where the package's name reaches every source
        expect(keptIn(root)).toStrictEqual(kept);
    });

    test('incrementalKeptWhileInputsHold — a source a spawned process loaded and the change deleted measures the spec’s mutants again', () => {
        // Given - a run that ended, its spec's processes seen loading h.ts
        const root = ranOnce(SPEC_RAN_A);

        // When - h.ts is deleted, and a run starts
        rmSync(join(root, 'src/h.ts'));
        startedIn(root);

        // Then - the spec's mutants go; b's test, which no longer finds h, keeps its own
        expect(keptIn(root)).toStrictEqual({ 'src/a.ts': [], 'src/b.ts': ['3'] });
    });

    test('incrementalKeptWhileInputsHold — a project git cannot list, run for the first time, starts from nothing', () => {
        // Given - a folder that is no repository, and no report nor record in it
        const root = mkdtempSync(join(tmpdir(), 'incremental-'));
        roots.push(root);

        // When - a run starts
        const inputs = startedIn(root);

        // Then - no inputs, nothing written
        expect([inputs, existsSync(join(root, '.artifacts/stryker'))]).toStrictEqual([
            undefined,
            false,
        ]);
    });
});
