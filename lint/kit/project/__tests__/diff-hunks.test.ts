import { describe, expect, test } from 'vitest';

import { hunksIn } from '../diff-hunks.js';

describe('diff-hunks', () => {
    test('hunksIn — every hunk with the file of the +++ line above it, a side stating no count holding one line', () => {
        // Given - a diff of two files: a rewrite and a pure deletion in the first, an addition stating no count in the second
        const diff = [
            'diff --git a/src/a.ts b/src/a.ts',
            '--- a/src/a.ts',
            '+++ b/src/a.ts',
            '@@ -3,2 +3,4 @@ export function a() {',
            '-old',
            '+new',
            '@@ -9 +10,0 @@',
            '-gone',
            '--- a/src/b.ts',
            '+++ b/src/b.ts',
            '@@ -0,0 +1 @@',
            '+added',
        ].join('\n');

        // Then - three hunks, in order, each side read from its own numbers
        expect(hunksIn(diff)).toStrictEqual([
            { added: { count: 4, from: 3 }, file: 'src/a.ts', removed: { count: 2, from: 3 } },
            { added: { count: 0, from: 10 }, file: 'src/a.ts', removed: { count: 1, from: 9 } },
            { added: { count: 1, from: 1 }, file: 'src/b.ts', removed: { count: 0, from: 0 } },
        ]);
    });

    test('hunksIn — a diff with no hunk, and a line that only opens like one, hold none', () => {
        // Given - an empty diff and a line of text starting with @@
        const texts = ['', '@@ not a hunk @@'];

        // Then - no hunk in either
        expect(texts.map((text) => hunksIn(text))).toStrictEqual([[], []]);
    });
});
