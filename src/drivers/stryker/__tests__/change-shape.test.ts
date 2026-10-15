import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, onTestFinished, test } from 'vitest';

import { changesOnlyFunctions, linesChangedIn } from '../change-shape.js';
import type { LinesChanged } from '../change-shape.js';

const MODULE = `import { a } from './a.js';
import type { B } from './b.js';
import './side-effect.js';
export type { C } from './c.js';
export { capped as cap } from './cap.js';

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

function diffed(before: string, after: string): LinesChanged {
    const folder = mkdtempSync(join(tmpdir(), 'change-shape-'));
    onTestFinished(() => {
        rmSync(folder, { force: true, recursive: true });
    });
    writeFileSync(join(folder, 'before.ts'), before);
    writeFileSync(join(folder, 'after.ts'), after);
    const diff = spawnSync(
        'git',
        ['diff', '--no-index', '--unified=0', '--', 'before.ts', 'after.ts'],
        {
            cwd: folder,
        },
    );

    return linesChangedIn(String(diff.stdout));
}

const shapeOf = (before: string, after: string): boolean =>
    changesOnlyFunctions('module.ts', { after, before }, diffed(before, after));

describe('change-shape', () => {
    test('linesChangedIn — the lines each hunk removes and adds, a hunk stating no count holding one line, a hunk of none holding none', () => {
        // Given - a diff rewriting line 2, adding two lines after 4, deleting line 9 and three lines from 12, and a content line that reads like a hunk
        const diff = [
            'diff --git a/before.ts b/after.ts',
            '--- a/before.ts',
            '+++ b/after.ts',
            '@@ -2 +2 @@',
            '-old',
            '+new',
            '@@ -4,0 +5,2 @@ function f() {',
            '+@@ -40 +40 @@',
            '+added',
            '@@ -9 +10,0 @@',
            '-gone',
            '@@ -12,3 +12,0 @@',
        ].join('\n');

        // Then - each side's lines, numbered from 1
        expect(linesChangedIn(diff)).toStrictEqual({
            added: [2, 5, 6],
            removed: [2, 9, 12, 13, 14],
        });
        expect(linesChangedIn('')).toStrictEqual({ added: [], removed: [] });
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
            'an import run for its effect',
            "import './side-effect.js';",
            "import './other.js';",
            false,
        ],
        [
            'a value re-exported',
            "export { capped as cap } from './cap.js';",
            "export { capped as limit } from './cap.js';",
            false,
        ],
        [
            'a type re-exported alone',
            "export type { C } from './c.js';",
            "export type { C } from './d.js';",
            true,
        ],
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
        expect(shapeOf(MODULE, after)).toBe(inFunctions);
    });

    test('changesOnlyFunctions — a function added or removed whole changes only what functions do', () => {
        // Given - the module with a new function at its end
        const added = `${MODULE}\nexport function unused(): number {\n    return 1;\n}\n`;

        // Then - adding it and taking it away again both stay inside functions
        expect([shapeOf(MODULE, added), shapeOf(added, MODULE)]).toStrictEqual([true, true]);
    });

    test('changesOnlyFunctions — a statement moved out of a function to the top level reaches what loads, and back in only what the function does', () => {
        // Given - a function calling a helper, and the same call moved to the module's top level
        const inside = 'export function run() {\n    start();\n}\n';
        const outside = 'export function run() {\n}\nstart();\n';

        // Then - out reaches what loading does; in, from the top level, reaches it too
        expect([shapeOf(inside, outside), shapeOf(outside, inside)]).toStrictEqual([false, false]);
    });

    test('changesOnlyFunctions — a module with no newline at its end is read up to its last line', () => {
        // Given - a one-line function with no newline after it
        const before = 'export function f() { return 1; }';
        const after = 'export function f() { return 2; }';

        // Then - the change stays inside the function
        expect(shapeOf(before, after)).toBe(true);
    });
});
