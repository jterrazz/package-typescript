import type { Diagnostic } from '@typescript/native/sync';
import { describe, expect, test } from 'vitest';

import { affectedErrors } from '../affected-errors.js';
import type { ImportGraph } from '../affected-errors.js';

const diagnostic = (text: string): Diagnostic => ({ category: 1, code: 1, end: 0, pos: 0, text });
const GRAPH: ImportGraph = {
    global: new Set(['g.ts']),
    importers: new Map([
        ['a.ts', new Set(['b.ts', 'c.ts'])],
        ['b.ts', new Set(['d.ts'])],
        ['c.ts', new Set(['d.ts'])],
        ['d.ts', new Set<string>()],
        ['g.ts', new Set<string>()],
    ]),
};
function walked(
    shapes: {
        base: (file: string) => string | undefined;
        now: (file: string) => string | undefined;
    },
    failing: ReadonlyMap<string, string> = new Map(),
    file = 'a.ts',
): { asked: (readonly string[] | undefined)[]; found: readonly Diagnostic[] } {
    const asked: (readonly string[] | undefined)[] = [];
    const found = affectedErrors(
        GRAPH,
        file,
        {
            errors: (files) => {
                asked.push(files);

                return (files ?? []).flatMap((name) => {
                    const text = failing.get(name);

                    return text === undefined ? [] : [diagnostic(text)];
                });
            },
            shape: shapes.now,
        },
        shapes.base,
    );

    return { asked, found };
}

describe('affected-errors', () => {
    test('a script or augmenting file is checked whole; a file with an error of its own answers alone', () => {
        // Given - a imported by b and c, both imported by d, and g a script
        // Then - the global one asks for every file's errors, the failing one for its own file only
        expect(walked({ base: () => 'x', now: () => 'y' }, new Map(), 'g.ts').asked).toStrictEqual([
            undefined,
        ]);
        expect(
            walked({ base: () => 'x', now: () => 'y' }, new Map([['a.ts', 'own']])),
        ).toStrictEqual({ asked: [['a.ts']], found: [diagnostic('own')] });
    });

    test('a file that looks the same from outside leaves its importers unchecked', () => {
        // Given - a imported by b and c, both imported by d, and g a script
        // Then - only the file itself is asked
        expect(walked({ base: () => 'same', now: () => 'same' })).toStrictEqual({
            asked: [['a.ts']],
            found: [],
        });
    });

    test('a file that looks different, or that cannot say how it looks, has each importer checked once, a level at a time', () => {
        // Given - a imported by b and c, both imported by d, and g a script
        // Then - the first level together, the shared importer once, and no empty ask
        expect(walked({ base: () => 'x', now: () => 'y' }).asked).toStrictEqual([
            ['a.ts'],
            ['b.ts', 'c.ts'],
            ['d.ts'],
        ]);
        expect(walked({ base: () => undefined, now: () => undefined }).asked).toStrictEqual([
            ['a.ts'],
            ['b.ts', 'c.ts'],
            ['d.ts'],
        ]);
        expect(walked({ base: () => 'x', now: () => undefined }).asked).toHaveLength(3);
    });

    test("an error in an importer is the mutant's, and ends the walk", () => {
        // Given - a imported by b and c, both imported by d, and g a script
        // Then - the failing importer's error returns before the next level is asked
        expect(
            walked({ base: () => 'x', now: () => 'y' }, new Map([['b.ts', 'far']])),
        ).toStrictEqual({
            asked: [['a.ts'], ['b.ts', 'c.ts']],
            found: [diagnostic('far')],
        });
    });
});
