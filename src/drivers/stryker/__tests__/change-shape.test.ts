import { describe, expect, test } from 'vitest';

import { changesOnlyFunctions, linesChanged } from '../change-shape.js';

const MODULE = `import { a } from './a.js';
import type { B } from './b.js';

// the limit a discount stops at
export const LIMIT = 5;

export function capped(value: number): number {
    return Math.min(value, LIMIT);
}

export const doubled = (value: number): number => {
    return value * 2;
};

class Counter {
    count = 0;

    add(): number {
        this.count += 1;
        return this.count;
    }
}

setTimeout(() => {
    capped(1);
}, 5);

type Shape = { side: number };

export const table = { name: 'table', size: () => 3 };
`;

const lines = (prefix: string): string =>
    Array.from({ length: 3000 }, (_, index) => `${prefix}${String(index)}`).join('\n');

describe('change-shape', () => {
    test('linesChanged — the lines each side holds that the other does not, numbered from 1', () => {
        // Given - a text, and the same with a line rewritten, one added and one removed
        const before = 'a\nb\nc\nd\n';
        const after = 'a\nB\nc\nx\n';

        // Then - what a diff would mark, on each side
        expect(linesChanged(before, after)).toStrictEqual({ added: [2, 4], removed: [2, 4] });
        expect(linesChanged('a\nb\n', 'a\nnew\nb\n')).toStrictEqual({ added: [2], removed: [] });
        expect(linesChanged('a\nold\nb\n', 'a\nb\n')).toStrictEqual({ added: [], removed: [2] });
        expect(linesChanged('same', 'same')).toStrictEqual({ added: [], removed: [] });
    });

    test('linesChanged — a pair too large to diff cheaply cannot say', () => {
        // Given - two texts of three thousand distinct lines each

        // Then - no answer, so the caller reads the change as reaching what loads
        expect(linesChanged(lines('a'), lines('b'))).toBeUndefined();
        expect(changesOnlyFunctions('m.ts', lines('a'), lines('b'))).toBe(false);
    });

    test.each([
        [
            'a line of a function body',
            'return Math.min(value, LIMIT);',
            'return Math.max(value, LIMIT);',
            true,
        ],
        ['a line of an arrow function body', 'return value * 2;', 'return value * 3;', true],
        ['a method', 'this.count += 1;', 'this.count += 2;', true],
        [
            'the body of a callback run as the module loads',
            '    capped(1);',
            '    capped(2);',
            true,
        ],
        ['a comment', '// the limit a discount stops at', '// where a discount stops', true],
        ['a type', 'type Shape = { side: number };', 'type Shape = { side: string };', true],
        [
            'a type-only import',
            "import type { B } from './b.js';",
            "import type { B } from './c.js';",
            true,
        ],
        ['a constant', 'export const LIMIT = 5;', 'export const LIMIT = 6;', false],
        ['an import', "import { a } from './a.js';", "import { a } from './z.js';", false],
        [
            'an argument passed as the module loads, on the line a callback closes',
            '}, 5);',
            '}, 6);',
            false,
        ],
        ['a class field', '    count = 0;', '    count = 1;', false],
        [
            'a value beside a function on one line',
            "name: 'table', size",
            "name: 'chair', size",
            false,
        ],
    ])('changesOnlyFunctions — %s', (_where, from, to, inFunctions) => {
        // Given - a module, and the same with that one line changed
        const after = MODULE.replace(from, to);

        // Then - whether the change reaches only what a function does when it runs
        expect(after).not.toBe(MODULE);
        expect(changesOnlyFunctions('module.ts', MODULE, after)).toBe(inFunctions);
    });

    test('changesOnlyFunctions — a function added or removed whole changes only what functions do', () => {
        // Given - the module with a new function at its end
        const added = `${MODULE}\nexport function unused(): number {\n    return 1;\n}\n`;

        // Then - adding it and taking it away again both stay inside functions
        expect([
            changesOnlyFunctions('module.ts', MODULE, added),
            changesOnlyFunctions('module.ts', added, MODULE),
        ]).toStrictEqual([true, true]);
    });
});
