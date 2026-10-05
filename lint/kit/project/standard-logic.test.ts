import { describe, expect, test } from 'vitest';

import { logicIn } from './standard-logic.js';

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
        // Given - a function, a branch, calls, operations, a computed string, a variable, an update, assignments and tagged templates
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
        ]);
    });
});
