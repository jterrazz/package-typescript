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
import { incrementalKeptWhileInputsHold, recordInputs } from '../incremental.js';
import { observedFrom } from '../observed.js';
import type { ObservedTest } from '../observed.js';
import { reportKept } from '../stryker.js';

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

const mutant = (id: string, coveredBy: string[], killedBy: string[] = []) => ({
    coveredBy,
    id,
    killedBy,
    location: { end: { column: 2, line: 1 }, start: { column: 1, line: 1 } },
    mutatorName: 'BooleanLiteral',
    status: killedBy.length > 0 ? 'Killed' : 'Survived',
});

const A_MUTANTS = [mutant('1', ['0', '1'], ['0']), mutant('2', ['1'], ['1'])];

const REPORT = {
    files: {
        'src/a.ts': { mutants: A_MUTANTS, source: 'a' },
        'src/b.ts': { mutants: [mutant('3', ['2'], ['2'])], source: 'b' },
    },
    schemaVersion: '2',
    testFiles: {
        'specs/a.spec.ts': { tests: [{ id: '1', name: 'a spec' }] },
        'src/__tests__/a.test.ts': { tests: [{ id: '0', name: 'a test' }] },
        'src/__tests__/b.test.ts': { tests: [{ id: '2', name: 'b test' }] },
    },
};

const quiet = (key: string): ObservedTest => ({ loaded: [], ran: [], test: key });

const MODULE_TESTS = [
    quiet('src/__tests__/a.test.ts#a test'),
    quiet('src/__tests__/b.test.ts#b test'),
];

const SPEC_QUIET = [...MODULE_TESTS, quiet('specs/a.spec.ts#a spec')];

const SPEC_RAN_A = [
    ...MODULE_TESTS,
    {
        loaded: ['src/a.ts', 'src/b.ts', 'src/h.ts'],
        ran: ['src/a.ts'],
        test: 'specs/a.spec.ts#a spec',
    },
];

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

const FILES = {
    'package.json': '{"name":"@scope/package"}',
    'specs/a.spec.ts': 'spec',
    'src/__tests__/a.test.ts': "import { a } from '../a.js';",
    'src/__tests__/b.test.ts': "import { b } from '../b.js';",
    'src/a.ts': 'a',
    'src/b.ts': "import { h } from './h.js';",
    'src/h.ts': 'export const H = 1;\n\nexport function h(): number {\n    return H;\n}\n',
};

function ranOnce(
    observed: readonly ObservedTest[] = MODULE_TESTS,
    files: Record<string, string> = FILES,
): string {
    const root = projectWith(files);
    const inputs = incrementalKeptWhileInputsHold(root, 'suite-incremental') ?? {};
    writeFileSync(reportOf(root), JSON.stringify(REPORT));
    recordInputs(root, 'suite-incremental', { inputs, observed: observedFrom(observed) });

    return root;
}

describe('incremental', () => {
    test('incrementalKeptWhileInputsHold — a run on the inputs its report was written on keeps the report whole, and records them again with no test followed yet', () => {
        // Given - a run that ended, its module tests seen spawning nothing
        const root = ranOnce();

        // When - a run starts on the same tree
        incrementalKeptWhileInputsHold(root, 'suite-incremental');

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
        incrementalKeptWhileInputsHold(root, 'suite-incremental');

        // Then - b's mutant is measured again, a's go with the spec the run never followed
        expect(keptIn(root)).toStrictEqual({ 'src/a.ts': [], 'src/b.ts': [] });
    });

    test('incrementalKeptWhileInputsHold — a change inside a function of a source the spec only loaded keeps the spec’s mutants, a change to what loads does not', () => {
        // Given - a run that ended, its spec's processes seen running a.ts and loading h.ts
        const body = ranOnce(SPEC_RAN_A);
        const loading = ranOnce(SPEC_RAN_A);

        // When - h's function changes in one tree, its constant in the other, and a run starts in each
        writeFileSync(
            join(body, 'src/h.ts'),
            FILES['src/h.ts'].replace('return H;', 'return H + 1;'),
        );
        writeFileSync(join(loading, 'src/h.ts'), FILES['src/h.ts'].replace('H = 1', 'H = 2'));
        incrementalKeptWhileInputsHold(body, 'suite-incremental');
        incrementalKeptWhileInputsHold(loading, 'suite-incremental');

        // Then - the function's change measures again b's mutant alone, the constant's the spec's too; the texts kept are this run's
        expect([keptIn(body), keptIn(loading)]).toStrictEqual([
            { 'src/a.ts': ['1', '2'], 'src/b.ts': [] },
            { 'src/a.ts': [], 'src/b.ts': [] },
        ]);
        expect(
            readdirSync(join(body, '.artifacts/stryker/suite-incremental.sources')),
        ).toHaveLength(3);
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
        incrementalKeptWhileInputsHold(root, 'suite-incremental');

        // Then - the spec's mutants are measured again with b's
        expect(keptIn(root)).toStrictEqual({ 'src/a.ts': [], 'src/b.ts': [] });
    });

    test('incrementalKeptWhileInputsHold — a run after one that never ended follows no test', () => {
        // Given - a run that started on the tree and never ended
        const root = ranOnce();
        incrementalKeptWhileInputsHold(root, 'suite-incremental');

        // When - a source no test imports appears, and a run starts
        writeFileSync(join(root, 'src/c.ts'), 'new');
        incrementalKeptWhileInputsHold(root, 'suite-incremental');

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
            incrementalKeptWhileInputsHold(root, 'suite-incremental', {
                cold: broken.cold === true,
            });

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
        const inputs = incrementalKeptWhileInputsHold(root, 'suite-incremental');

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
        incrementalKeptWhileInputsHold(root, 'suite-incremental');

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
            inputs: reportKept(root, suite, false) ?? {},
            observed: observedFrom([]),
        });
        recordInputs(root, 'incremental', {
            inputs: reportKept(root, modules, false) ?? {},
            observed: observedFrom([]),
        });
        writeFileSync(suiteReport, '{}');
        writeFileSync(modulesReport, '{}');

        // When - a warm start of each, then a cold one of each
        reportKept(root, suite, false);
        reportKept(root, modules, false);
        const warm = [existsSync(suiteReport), existsSync(modulesReport)];
        reportKept(root, modules, true);
        const afterModules = [existsSync(suiteReport), existsSync(modulesReport)];
        reportKept(root, suite, true);

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
        incrementalKeptWhileInputsHold(root, 'suite-incremental');

        // Then - a's mutant goes only where the package's name reaches every source
        expect(keptIn(root)).toStrictEqual(kept);
    });

    test('incrementalKeptWhileInputsHold — a source a spawned process loaded and the change deleted measures the spec’s mutants again', () => {
        // Given - a run that ended, its spec's processes seen loading h.ts
        const root = ranOnce(SPEC_RAN_A);

        // When - h.ts is deleted, and a run starts
        rmSync(join(root, 'src/h.ts'));
        incrementalKeptWhileInputsHold(root, 'suite-incremental');

        // Then - the spec's mutants go; b's test, which no longer finds h, keeps its own
        expect(keptIn(root)).toStrictEqual({ 'src/a.ts': [], 'src/b.ts': ['3'] });
    });

    test('incrementalKeptWhileInputsHold — a project git cannot list, run for the first time, starts from nothing', () => {
        // Given - a folder that is no repository, and no report nor record in it
        const root = mkdtempSync(join(tmpdir(), 'incremental-'));
        roots.push(root);

        // When - a run starts
        const inputs = incrementalKeptWhileInputsHold(root, 'suite-incremental');

        // Then - no inputs, nothing written
        expect([inputs, existsSync(join(root, '.artifacts/stryker'))]).toStrictEqual([
            undefined,
            false,
        ]);
    });
});
