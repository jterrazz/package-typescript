import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';

import { isList, objectOf, parsedObject } from '../../../../lint/kit/project/json.js';
import {
    changedBetween,
    incrementalKeptWhileInputsHold,
    inputsOf,
    recordInputs,
    reportAfter,
} from '../incremental.js';
import type { Staleness } from '../incremental.js';
import { reachOf } from '../inputs.js';
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

const SOURCES = new Map([
    ['src/a.ts', ''],
    ['src/b.ts', "import { h } from './h.js';"],
    ['src/h.ts', ''],
    ['src/__tests__/a.test.ts', "import { a } from '../a.js';"],
    ['src/__tests__/b.test.ts', "import { b } from '../b.js';"],
]);

const QUIET = ['src/__tests__/a.test.ts#a test', 'src/__tests__/b.test.ts#b test'];

const SPEC_QUIET = [...QUIET, 'specs/a.spec.ts#a spec'];

const staleness = (quiet: readonly string[]): Staleness => ({
    quiet: new Set(quiet),
    reach: reachOf(SOURCES, '@scope/package'),
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

function keptIds(
    changed: string[],
    quiet: readonly string[] = QUIET,
): Record<string, string[]> | undefined {
    const report = reportAfter(REPORT, changed, staleness(quiet));

    return report === undefined ? undefined : idsByFile(report);
}

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
    'src/h.ts': 'h',
};

function ranOnce(): string {
    const root = projectWith(FILES);
    const inputs = incrementalKeptWhileInputsHold(root, 'suite-incremental') ?? {};
    writeFileSync(reportOf(root), JSON.stringify(REPORT));
    recordInputs(root, 'suite-incremental', { inputs, quiet: QUIET });

    return root;
}

describe('incremental', () => {
    test('reportAfter — a change in a covering test re-measures every mutant it covered or killed, and no other', () => {
        // Given - the report of a run
        // When - the spec changes
        const kept = keptIds(['specs/a.spec.ts']);

        // Then - both mutants it covers go, b's stays
        expect(kept).toStrictEqual({ 'src/a.ts': [], 'src/b.ts': ['3'] });
    });

    test('reportAfter — a helper a quiet test loads re-measures that test’s mutants, though neither the mutated source nor the test changed', () => {
        // Given - the report of a run, its module tests seen quiet and its spec not
        // When - h.ts, which b.ts imports, changes
        const kept = keptIds(['src/h.ts']);

        // Then - b's mutant goes with its test; a's module test does not reach h, but the spec, never seen quiet, may load any source
        expect(kept).toStrictEqual({ 'src/a.ts': [], 'src/b.ts': [] });
    });

    test('reportAfter — a source change leaves the mutants whose every covering test is quiet and out of its reach', () => {
        // Given - the report of a run, its spec seen quiet too
        // When - h.ts changes
        const kept = keptIds(['src/h.ts'], SPEC_QUIET);

        // Then - only b's mutant, whose test reaches h, is measured again
        expect(kept).toStrictEqual({ 'src/a.ts': ['1', '2'], 'src/b.ts': [] });
    });

    test('reportAfter — every mutant of a changed source is measured again, whoever covers it', () => {
        // Given - the report of a run, every test seen quiet
        // When - b.ts itself changes
        const kept = keptIds(['src/b.ts'], SPEC_QUIET);

        // Then - its file leaves the report whole
        expect(kept).toStrictEqual({ 'src/a.ts': ['1', '2'] });
    });

    test.each([
        [
            'under the folder of the module tests',
            'src/__tests__/__fixtures__/f.json',
            { 'src/a.ts': ['2'], 'src/b.ts': [] },
        ],
        ['under the specs', 'specs/__expected__/out.txt', { 'src/a.ts': [], 'src/b.ts': ['3'] }],
        ['at the root', '__fixtures__/f.json', { 'src/a.ts': [], 'src/b.ts': [] }],
    ])(
        'reportAfter — ground %s re-measures what the tests below it covered',
        (_where, ground, kept) => {
            // Given - the report of a run, every test seen quiet
            // Then - a test under the ground's folder is stale, one beside it is not
            expect(keptIds([ground], SPEC_QUIET)).toStrictEqual(kept);
        },
    );

    test.each([
        ['a setup file', 'specs/__setup__/seed.ts'],
        ['a root config', 'vitest.config.ts'],
        ['the install', 'node_modules/.package-lock.json'],
        ['a data file code reads', 'src/catalogue.json'],
    ])('reportAfter — %s reaches every test, so no result of the report stands', (_kind, path) => {
        // Given - the report of a run, every test seen quiet
        // Then - nothing is kept
        expect(keptIds([path], SPEC_QUIET)).toBeUndefined();
    });

    test('reportAfter — nothing changed keeps every result, and the rest of the report as it was', () => {
        // Given - the report of a run
        // When - it is read against no change
        const report = reportAfter(REPORT, [], staleness([]));

        // Then - the same report
        expect(report).toStrictEqual(REPORT);
    });

    test('reportAfter — a new test file takes nothing out, and a report with no tests keeps its mutants', () => {
        // Given - a report with no test file and a mutant no test covers
        const bare = { files: { 'src/a.ts': { mutants: [mutant('1', [])] } } };

        // When - a test file the report never ran is added
        const report = reportAfter(bare, ['src/__tests__/new.test.ts'], staleness([]));

        // Then - the report stands
        expect(report).toStrictEqual(bare);
    });

    test('changedBetween — a file whose bytes differ, one added and one removed', () => {
        // Given - two records of the inputs
        const before = { a: '1', b: '2', c: '3' };
        const after = { a: '1', b: '9', d: '4' };

        // Then - each change once, the unchanged file left out
        expect(changedBetween(before, after).toSorted()).toStrictEqual(['b', 'c', 'd']);
    });

    test('inputsOf — hashes every file git lists, the ignored ones, folders and the run’s own output aside, and stands for an absent install', () => {
        // Given - a source, an ignored file, and a report of the run git would list
        const root = projectWith({
            '.artifacts/stryker/report.json': '{}',
            '.gitignore': 'ignored.ts\n',
            'ignored.ts': 'x',
            'src/a.ts': 'a',
        });

        // When - the inputs are read
        const inputs = inputsOf(root) ?? {};

        // Then - every listed file by its hash, the install as absent
        expect(Object.keys(inputs).toSorted()).toStrictEqual([
            '.gitignore',
            'node_modules/.package-lock.json',
            'src/a.ts',
        ]);
        expect([inputs['src/a.ts'], inputs['node_modules/.package-lock.json']]).toStrictEqual([
            'ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb',
            'absent',
        ]);
    });

    test('inputsOf — the install is read by its hash once there is one', () => {
        // Given - an install
        const root = projectWith({ 'src/a.ts': 'a' });
        mkdirSync(join(root, 'node_modules'));
        writeFileSync(join(root, 'node_modules/.package-lock.json'), 'a');

        // Then - its bytes' hash
        expect(inputsOf(root)?.['node_modules/.package-lock.json']).toBe(
            'ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb',
        );
    });

    test('incrementalKeptWhileInputsHold — a run on the inputs its report was written on keeps the report whole, and records them again with no test quiet yet', () => {
        // Given - a run that ended, its module tests seen quiet
        const root = ranOnce();

        // When - a run starts on the same tree
        incrementalKeptWhileInputsHold(root, 'suite-incremental');

        // Then - the report stands, and the record names no quiet test until this run ends
        expect(parsedAt(reportOf(root))).toStrictEqual(REPORT);
        expect(objectOf(recordOf(root).inputs)['src/a.ts']).toStrictEqual(expect.any(String));
        expect(recordOf(root)).not.toHaveProperty('quiet');
    });

    test('incrementalKeptWhileInputsHold — a changed helper takes out the mutants of the quiet tests that load it', () => {
        // Given - a run that ended
        const root = ranOnce();

        // When - the helper changes and a run starts
        writeFileSync(join(root, 'src/h.ts'), 'changed');
        incrementalKeptWhileInputsHold(root, 'suite-incremental');

        // Then - b's mutant is measured again, a's go with the spec never seen quiet
        expect(keptIn(root)).toStrictEqual({ 'src/a.ts': [], 'src/b.ts': [] });
    });

    test('incrementalKeptWhileInputsHold — a run after one that never ended reads no test as quiet', () => {
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
        recordInputs(root, 'suite-incremental', { inputs: reportKept(root, suite, false) ?? {}, quiet: [] });
        recordInputs(root, 'incremental', { inputs: reportKept(root, modules, false) ?? {}, quiet: [] });
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
});
