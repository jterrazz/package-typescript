import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, describe, expect, test } from 'vitest';

import { changedRanges, fileOfRange, modulesMutated, sourcesOf, unreachedRange } from '../scope.js';

const SCOPE = {
    exclude: [],
    glue: { bar: 0.9, cap: 50, globs: [] },
    ignore: ['src/generated/**'],
    mutated: ['src/**/*.ts', 'src/**/*.tsx', 'lint/*.ts'],
    presentation: [],
};

const SOURCES: ReadonlySet<string> = new Set(['src/a.ts', 'src/b.ts']);

const created: string[] = [];

afterAll(() => {
    for (const root of created) {
        rmSync(root, { force: true, recursive: true });
    }
});

function treeOf(files: readonly string[]): string {
    const root = mkdtempSync(join(tmpdir(), 'mutation-scope-'));
    created.push(root);
    for (const file of files) {
        mkdirSync(join(root, dirname(file)), { recursive: true });
        writeFileSync(join(root, file), '');
    }

    return root;
}

const twoLines = (): string => 'export const one = 1;\nexport const two = 2;\n';

describe('scope', () => {
    test('splits the sources the declaration names by whether a module test sits in their folder’s __tests__/, leaving out tests, fixtures and what it ignores', () => {
        // Given - a source with its test, one with a .tsx test, one with none, a fixture, an expected file, a type test, a helper of the tests, tests, a type test and fixtures that sit beside their module, a generated source the project ignores, a source with its test in a folder whose name holds .ts, and a lint entry
        const root = treeOf([
            'src/a.ts',
            'src/__tests__/a.test.ts',
            'src/b.ts',
            'src/__tests__/b.test.tsx',
            'src/c.ts',
            'src/__fixtures__/d.ts',
            'src/__tests__/e.fixtures.ts',
            'src/generated/f.ts',
            'src/__tests__/g.test-d.ts',
            'src/beside.test.ts',
            'src/beside.test.tsx',
            'src/beside.test-d.ts',
            'src/beside.fixtures.ts',
            'src/__tests__/stub.ts',
            'src/__expected__/h.ts',
            'src/legacy.ts.d/i.ts',
            'src/legacy.ts.d/__tests__/i.test.ts',
            'lint/rule.ts',
        ]);

        // Then - each source once, sorted, on its side
        expect(sourcesOf(root, SCOPE)).toStrictEqual({
            tested: ['src/a.ts', 'src/b.ts', 'src/legacy.ts.d/i.ts'],
            untested: ['lint/rule.ts', 'src/c.ts'],
        });
    });

    test('a range names its file, in either spelling, and the module tests measure the ranges --mutate names in their sources, else the lines the change reaches, else every source whole where git cannot say', () => {
        // Given - ranges by lines and by positions, a whole file, and a range in a source outside the list, beside a change rewriting line 2 of one tested source
        const ranges = ['src/a.ts:10-20', 'src/b.ts:3:14-5:16', 'src/c.ts', 'src/z.ts:1-2'];
        const tested = ['src/a.ts', 'src/b.ts', 'src/c.ts'];
        const changed = new Map([['src/b.ts', [[2, 2] as const]]]);

        // Then - each range's file; the named ranges of the listed sources, the changed line, nothing of an empty change, and every source where the change is unknown
        expect(ranges.map((range) => fileOfRange(range))).toStrictEqual([
            'src/a.ts',
            'src/b.ts',
            'src/c.ts',
            'src/z.ts',
        ]);
        expect([
            modulesMutated(tested, { changed, known: true, ranges }, twoLines),
            modulesMutated(tested, { changed, known: true, ranges: undefined }, twoLines),
            modulesMutated(
                tested,
                { changed: new Map(), known: true, ranges: undefined },
                twoLines,
            ),
            modulesMutated(
                tested,
                { changed: new Map(), known: false, ranges: undefined },
                twoLines,
            ),
        ]).toStrictEqual([
            ['src/a.ts:10-20', 'src/b.ts:3:14-5:16', 'src/c.ts'],
            ['src/b.ts:2-2'],
            [],
            ['src/a.ts', 'src/b.ts', 'src/c.ts'],
        ]);
    });

    test('a run measures each hunk of code the change made in a source, and an added source whole', () => {
        // Given - a change of seven hunks in one untested source (two of code, one of an import and a blank line, one of comments, one opening an import over several lines, one of an import with code after it on its line, one of a doc comment with an empty line), one added, and one in a source left out
        const source = [
            "import { a } from './a.js';",
            '',
            'export const one = 1;',
            '// a note',
            '/**',
            ' * a doc',
            ' */',
            '',
            'export const two = a * 2;',
            'import {',
            '    b,',
            "import { c } from './c.js'; export const d = c;",
            '/**',
            ' *',
            ' */',
        ].join('\n');
        const changed = new Map<string, (readonly [number, number])[] | true>([
            [
                'src/c.ts',
                [
                    [1, 2],
                    [3, 4],
                    [5, 8],
                    [9, 9],
                    [10, 11],
                    [12, 12],
                    [13, 15],
                ],
            ],
            ['src/new.ts', true],
            ['src/elsewhere.ts', [[1, 1]]],
        ]);

        // Then - a range of whole lines per hunk holding code, a hunk it cannot read as no code kept, the added file whole, and nothing of a file the change missed
        expect(
            changedRanges(['src/c.ts', 'src/new.ts', 'src/untouched.ts'], changed, (file) =>
                file === 'src/c.ts' ? source : '',
            ),
        ).toStrictEqual([
            'src/c.ts:3-4',
            'src/c.ts:9-9',
            'src/c.ts:10-12',
            'src/c.ts:12-12',
            'src/new.ts',
        ]);
    });

    test('unreachedRange — reaches every source named whole, by its lines, or by its lines and columns', () => {
        // Given - ranges naming the sources in each form --mutate takes
        // Then - none is unreached
        expect(
            unreachedRange(
                ['src/a.ts', 'src/a.ts:3-3', 'src/b.ts:1:2-4:5', 'src/b.ts:10:12-20:30'],
                SOURCES,
            ),
        ).toBeUndefined();
    });

    test.each([
        ['a path the run does not mutate', 'src/c.ts:1-2'],
        ['a bare word', 'x'],
        ['an empty range', ''],
        ['lines written backwards', 'src/a.ts:9-2'],
        ['lines with no end', 'src/a.ts:3'],
        ['lines that are no numbers', 'src/a.ts:a-b'],
        ['a path behind a word and a colon', 'x:src/a.ts'],
    ])('unreachedRange — names %s as the range that reaches nothing', (_case, range) => {
        // Given - a reached range, then the stray one
        // Then - the stray one is named
        expect(unreachedRange(['src/a.ts:1-2', range], SOURCES)).toBe(range);
    });
});
