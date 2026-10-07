import { describe, expect, test } from 'vitest';

import { logicIn } from '../standard-logic.js';

const lines = (...text: string[]): string => text.join('\n');

describe('standard-logic', () => {
    test('a standard that states its values holds no logic', () => {
        // Given - a standard spreading a shared constant, with a raw pattern, a negative number, and types whose members read as accessors
        const text = lines(
            "import { defineStandard } from '@jterrazz/typescript/config';",
            "import { SHARED } from './shared.js';",
            "export const ROOT: { get name(): string } = { name: 'routes' };",
            'const PATTERN = String.raw`\\.test\\.ts$`;',
            'type Sized = { get size(): number };',
            'interface Named { get name(): string }',
            'export default defineStandard({ typescript: { ...SHARED, roots: [ROOT], depth: -1 } });',
        );

        // Then - nothing is computed
        expect(logicIn('standard.ts', text)).toStrictEqual([]);
    });

    test('names each thing a standard computes, by its line', () => {
        // Given - a function, a branch, calls, operations — unary ones and typeof, void and delete among them — a computed string, a variable, updates, assignments, tagged templates, a negative bigint, which is data, and another operator on a number, which is not
        const text = lines(
            'const pick = (value) => value;',
            "const kind = process.env.KIND === 'api' ? 'api' : 'cli';",
            "const root = ['src'].join('/');",
            'const both = 1 + 2;',
            ['const named = `$', '{kind}-root`;'].join(''),
            'let count = 0;',
            'count++;',
            ['const tagged = String.raw`$', '{named}`;'].join(''),
            "const picked = pick('a');",
            'count = 2;',
            'const marked = html`<p></p>`;',
            "const held = 'roots' in SHARED;",
            'count ^= 1;',
            'const off = !held;',
            'const below = -count;',
            'const flipped = ~count;',
            '--count;',
            'const kind = typeof held;',
            'const nothing = void 0;',
            'delete SHARED.roots;',
            'const big = -1n;',
            'const mask = ~1;',
        );

        // Then - each is named where it stands
        expect(logicIn('standard.ts', text)).toStrictEqual([
            { line: 1, what: 'a function' },
            { line: 2, what: 'a branch' },
            { line: 2, what: 'an operation' },
            { line: 3, what: 'a call' },
            { line: 4, what: 'an operation' },
            { line: 5, what: 'a computed string' },
            { line: 6, what: 'a variable' },
            { line: 7, what: 'an assignment' },
            { line: 8, what: 'a call' },
            { line: 8, what: 'a computed string' },
            { line: 9, what: 'a call' },
            { line: 10, what: 'an assignment' },
            { line: 11, what: 'a call' },
            { line: 12, what: 'an operation' },
            { line: 13, what: 'an assignment' },
            { line: 14, what: 'an operation' },
            { line: 15, what: 'an operation' },
            { line: 16, what: 'an operation' },
            { line: 17, what: 'an assignment' },
            { line: 18, what: 'an operation' },
            { line: 19, what: 'an operation' },
            { line: 20, what: 'an operation' },
            { line: 22, what: 'an operation' },
        ]);
    });

    test('standard-logic — names each statement and declaration that computes, by its kind', () => {
        // Given - one of each kind a standard never holds, and a constant whose name only contains a keyword
        const cases = [
            'async function load() {}',
            'const loaded = await ready;',
            'class Shape {}',
            'const Shape = class {};',
            'do {} while (ready);',
            'for (const key in SHARED) {}',
            'for (const key of SHARED) {}',
            'for (;;) {}',
            'const run = function () {};',
            'const shape = { get size() { return 1; } };',
            'if (ready) {}',
            'const shape = { size() {} };',
            'const roots = new Set();',
            'const shape = { set size(value) {} };',
            'switch (ready) {}',
            "throw new Error('no');",
            'try {} catch {}',
            'while (ready) {}',
        ];

        // Then - each kind is named, beside what it holds of another kind, and the constant is data
        expect(
            cases.map((text) => logicIn('standard.ts', text).map(({ what }) => what)),
        ).toStrictEqual([
            ['a function'],
            ['an await'],
            ['a class'],
            ['a class'],
            ['a loop'],
            ['a loop'],
            ['a loop'],
            ['a loop'],
            ['a function'],
            ['a function'],
            ['a branch'],
            ['a function'],
            ['a construction'],
            ['a function'],
            ['a branch'],
            ['a throw', 'a construction'],
            ['a try'],
            ['a loop'],
        ]);
        expect(logicIn('standard.ts', 'const outlet = 1;')).toStrictEqual([]);
    });
});
