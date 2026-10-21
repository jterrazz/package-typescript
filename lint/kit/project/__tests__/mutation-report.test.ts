import { describe, expect, test } from 'vitest';

import { objectOf } from '../json.js';
import {
    mutantsOf,
    reportEdited,
    reportPathOf,
    testFileOf,
    testKeyOf,
    testsOf,
} from '../mutation-report.js';

describe('mutation-report', () => {
    test('reportPathOf — each stage writes its own report under the mutation output', () => {
        // Given - the two stages of a run
        const stages = ['modules', 'suite'] as const;

        // Then - the module run and the suite run each name their file
        expect(stages.map((stage) => reportPathOf(stage))).toStrictEqual([
            '.artifacts/stryker/report.json',
            '.artifacts/stryker/suite-report.json',
        ]);
    });

    test('mutantsOf — walks every mutant beside its file, a file listing none giving nothing and a non-object mutant read as an empty one', () => {
        // Given - two files listing mutants, one listing none, and a report with no files
        const report = {
            files: {
                'src/a.ts': { mutants: [{ id: '1' }, { id: '2' }] },
                'src/b.ts': { mutants: 'none' },
                'src/c.ts': { mutants: ['odd'] },
            },
        };

        // Then - each mutant with its file, in the report's order
        expect(mutantsOf(report)).toStrictEqual([
            ['src/a.ts', { id: '1' }],
            ['src/a.ts', { id: '2' }],
            ['src/c.ts', {}],
        ]);
        expect(mutantsOf({})).toStrictEqual([]);
        expect(mutantsOf('no report')).toStrictEqual([]);
    });

    test('reportEdited — a file is dropped, cut or kept whole as the edit answers, and the rest of the report is carried', () => {
        // Given - a report of three files and a field beside them
        const kept = { mutants: 'none', source: 'kept' };
        const report = {
            files: {
                'src/cut.ts': { mutants: [{ id: '1' }, { id: '2' }], source: 'cut' },
                'src/dropped.ts': { mutants: [{ id: '3' }] },
                'src/kept.ts': kept,
            },
            schemaVersion: '2',
        };

        // When - one file is dropped, one cut to its first mutant, one handed back as it came
        const edited = reportEdited(report, (file, mutants) => {
            const held = file === 'src/cut.ts' ? mutants.slice(0, 1) : mutants;

            return file === 'src/dropped.ts' ? undefined : held;
        });

        // Then - the cut file keeps its other fields, the kept one is the entry itself
        expect(edited).toStrictEqual({
            files: {
                'src/cut.ts': { mutants: [{ id: '1' }], source: 'cut' },
                'src/kept.ts': kept,
            },
            schemaVersion: '2',
        });
        expect(objectOf(edited.files)['src/kept.ts']).toBe(kept);
        expect(reportEdited(undefined, (_, mutants) => mutants)).toStrictEqual({ files: {} });
    });

    test('testKeyOf, testFileOf — a key joins a file and a name, and gives the file back whatever the name holds', () => {
        // Given - a name holding the join itself
        const key = testKeyOf('specs/a.spec.ts', 'a > b # c');

        // Then - the key, and the file read back from it
        expect(key).toBe('specs/a.spec.ts#a > b # c');
        expect(testFileOf(key)).toBe('specs/a.spec.ts');
        expect(testFileOf('specs/bare.spec.ts')).toBe('specs/bare.spec.ts');
    });

    test('testsOf — every listed test by its id, a nameless one keyed by its file alone, a file listing none giving nothing', () => {
        // Given - two test files, one with a nameless test, and one listing none
        const report = {
            testFiles: {
                'specs/a.spec.ts': { tests: [{ id: '0', name: 'one' }, { id: 1 }] },
                'specs/b.spec.ts': { tests: 'none' },
            },
        };

        // Then - each test by its id as a string
        expect([...testsOf(report)]).toStrictEqual([
            ['0', { file: 'specs/a.spec.ts', key: 'specs/a.spec.ts#one' }],
            ['1', { file: 'specs/a.spec.ts', key: 'specs/a.spec.ts#' }],
        ]);
        expect(testsOf(undefined).size).toBe(0);
    });
});
