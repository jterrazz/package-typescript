import { matchesGlob } from 'node:path';
import { describe, expect, test } from 'vitest';

import {
    heldReport,
    linesEntry,
    mutatedLines,
    mutateEntryOf,
    nodeEntry,
    strykerMutate,
} from '../mutate-entries.js';

const mutant = (from: [number, number], to: [number, number]): object => ({
    location: { end: { column: to[1], line: to[0] }, start: { column: from[1], line: from[0] } },
});

describe('mutate-entries', () => {
    test('strykerMutate — every character a glob reads is a class of its own, a range kept beside it, a plain path and a brace with no comma left as they read', () => {
        // Given - a plain path, a route in brackets by lines and columns, a group, a catch-all, a star, a question mark and a brace with no comma
        const entries = strykerMutate([
            'src/a.ts:3-4',
            'src/[id]/[key].ts:2:4-5:0',
            'app/(group)/page.tsx',
            'src/[...all].ts',
            'src/x*y?.ts',
            'src/{id}.ts:10-12',
            'src/a,b.ts:10:12-11:15',
        ]);

        // Then - each matches its own path alone under minimatch, as Stryker resolves it after turning backslashes into slashes
        expect(entries).toStrictEqual([
            'src/a.ts:3-4',
            'src/[[]id[]]/[[]key[]].ts:2:4-5:0',
            'app/[(]group[)]/page.tsx',
            'src/[[]...all[]].ts',
            'src/x[*]y[?].ts',
            'src/[{]id[}].ts:10-12',
            'src/a,b.ts:10:12-11:15',
        ]);
        expect(
            [
                ['src/[id]/[key].ts', 'src/[[]id[]]/[[]key[]].ts'],
                ['src/i/k.ts', 'src/[[]id[]]/[[]key[]].ts'],
                ['app/(group)/page.tsx', 'app/[(]group[)]/page.tsx'],
                ['src/[...all].ts', 'src/[[]...all[]].ts'],
                ['src/x*y?.ts', 'src/x[*]y[?].ts'],
                ['src/xzyz.ts', 'src/x[*]y[?].ts'],
                ['src/{id}.ts', 'src/[{]id[}].ts'],
            ].map(([file = '', pattern = '']) => matchesGlob(file, pattern)),
        ).toStrictEqual([true, false, true, true, true, false, true]);
    });

    test('strykerMutate — a file whose braces hold a comma goes whole, once, through a question mark where each comma stood', () => {
        // Given - two ranges of a file named with a comma between braces
        const entries = strykerMutate(['src/{a,b}.ts:1-2', 'src/{a,b}.ts:5-6']);

        // Then - one entry, without the ranges no glob may sit beside
        expect(entries).toStrictEqual(['src/[{]a?b[}].ts']);
        expect(matchesGlob('src/{a,b}.ts', String(entries[0]))).toBe(true);
    });

    test('heldReport — a file handed whole keeps the mutants its ranges hold, start and end, and a braced file beside it no entry names goes; every other file is kept as reported', () => {
        // Given - a report of the widened file, of a braced file the widened glob matched beside it, of a plain file Stryker held to its range itself, and of a widened file whose entry carries no mutant list
        const report = {
            files: {
                'src/a.ts': { mutants: [mutant([90, 1], [90, 4])] },
                'src/{a,b}.ts': {
                    language: 'typescript',
                    mutants: [
                        mutant([10, 1], [10, 5]),
                        mutant([11, 3], [12, 1]),
                        mutant([14, 11], [14, 19]),
                        mutant([14, 12], [14, 19]),
                        mutant([16, 1], [16, 19]),
                        mutant([16, 1], [16, 20]),
                        mutant([17, 1], [17, 9]),
                    ],
                },
                'src/{a;b}.ts': { mutants: [mutant([10, 1], [10, 5])] },
                'src/{c,d}.ts': { language: 'typescript' },
            },
            schemaVersion: '2',
        };

        // When - the widened file is held to lines 10-11 and to line 14 from its twelfth column to line 16's nineteenth
        const held = heldReport(report, [
            'src/a.ts:1-2',
            'src/{a,b}.ts:10-11',
            'src/{a,b}.ts:14:11-16:18',
            'src/{c,d}.ts:1-2',
        ]);

        // Then - the mutants within either range stay; the one running past them, the one starting a column early, the one ending a column late and the one after them go
        expect(held).toStrictEqual({
            files: {
                'src/a.ts': { mutants: [mutant([90, 1], [90, 4])] },
                'src/{a,b}.ts': {
                    language: 'typescript',
                    mutants: [
                        mutant([10, 1], [10, 5]),
                        mutant([14, 12], [14, 19]),
                        mutant([16, 1], [16, 19]),
                    ],
                },
                'src/{c,d}.ts': { language: 'typescript', mutants: [] },
            },
            schemaVersion: '2',
        });
    });

    test('heldReport — a widened file named whole keeps every mutant, and a report of plain entries is the report itself', () => {
        // Given - a report of a widened file
        const report = { files: { 'src/{a,b}.ts': { mutants: [mutant([7, 1], [7, 9])] } } };

        // Then - named whole beside a range it keeps the mutant outside the range; with no widened entry it is returned untouched
        expect(heldReport(report, ['src/{a,b}.ts', 'src/{a,b}.ts:1-2'])).toStrictEqual(report);
        expect(heldReport(report, ['src/a.ts'])).toBe(report);
    });

    test('mutatedLines — each file holds every line its ranges cover, from both ends, and a file any entry names whole is held whole', () => {
        // Given - two ranges of one file, a file named whole and by a range, and a range by lines and columns
        const lines = mutatedLines([
            'src/a.ts:3-5',
            'src/a.ts:8-8',
            'src/b.ts',
            'src/b.ts:1-2',
            'src/c.ts:2:4-3:1',
        ]);

        // Then - the lines of each range, counted from 1, and the whole file as undefined
        expect(Object.fromEntries(lines)).toStrictEqual({
            'src/a.ts': [3, 4, 5, 8],
            'src/b.ts': undefined,
            'src/c.ts': [2, 3],
        });
    });

    test('mutateEntryOf — a path, a range of lines and a range of columns are read as Stryker reads them, and a path holding a colon names no entry', () => {
        // Given - a file whole, a range of lines, a range with columns, and texts the grammar refuses
        const read = ['src/a.ts', 'src/a.ts:3-5', 'src/a.ts:2:4-5:7'].map((text) =>
            mutateEntryOf(text),
        );
        const refused = ['src/a:b.ts', 'src/a:b.ts:1-2', 'src/a.ts:3', 'src/a.ts:-4'];

        // Then - the open ends reach the line's first and last column; the refused texts are no entry
        expect(read).toStrictEqual([
            { file: 'src/a.ts', range: undefined, text: 'src/a.ts' },
            {
                file: 'src/a.ts',
                range: { from: [3, 0], to: [5, Number.MAX_SAFE_INTEGER] },
                text: 'src/a.ts:3-5',
            },
            { file: 'src/a.ts', range: { from: [2, 4], to: [5, 7] }, text: 'src/a.ts:2:4-5:7' },
        ]);
        expect(refused.map((text) => mutateEntryOf(text))).toStrictEqual(
            refused.map(() => undefined),
        );
    });

    test('linesEntry, nodeEntry — an entry of whole lines, and one of exactly a node a report locates, its columns counted from 0', () => {
        // Given - lines 3 to 7, and a node from line 2 column 5 to line 4 column 1 as a report counts them
        const lines = linesEntry('src/a.ts', 3, 7);
        const node = nodeEntry('src/a.ts', [2, 5], [4, 1]);

        // Then - each reads back to what it was built from
        expect([lines, node]).toStrictEqual(['src/a.ts:3-7', 'src/a.ts:2:4-4:0']);
        expect(mutateEntryOf(node)?.range).toStrictEqual({ from: [2, 4], to: [4, 0] });
    });
});
