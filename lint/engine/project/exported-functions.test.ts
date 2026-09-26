import { describe, expect, test } from 'vitest';

import { exportedFunctions } from './exported-functions.js';

describe('exported-functions', () => {
    test('names every function and class a module exports, however it is written', () => {
        // Given - a declaration, an async one, a class, arrows with and without parentheses, a generic, an ambient declaration
        const text = [
            'export function plain() {}',
            'export async function waited() {}',
            'export class Shape {}',
            'export const arrow = (value, fallback = pick(1)) => value;',
            'export const bare = value => value;',
            'export const typed = <Value>(value: Value): Value => value;',
            'export declare function ambient(tree: Tree): Finding[];',
        ].join('\n');

        // Then - each one is named
        expect(exportedFunctions(text)).toStrictEqual([
            'plain',
            'waited',
            'Shape',
            'ambient',
            'arrow',
            'bare',
            'typed',
        ]);
    });

    test('names a local function exported by a list, under the name it is exported as', () => {
        // Given - two local functions and a value, listed; and a re-export from another module
        const text = [
            'function walk() {}',
            'const read = (path) => path;',
            'const LIMIT = 3;',
            'export { walk, read as readAt, LIMIT };',
            "export { other } from './other.js';",
        ].join('\n');

        // Then - the two functions are named, the value and the re-export are not
        expect(exportedFunctions(text)).toStrictEqual(['walk', 'readAt']);
    });

    test('names no value, whatever its expression opens on, nor the default export', () => {
        // Given - a parenthesised value, an object carrying a method, a constant, a default function
        const text = [
            'export const rows = (Array.isArray(parsed) ? parsed : []).filter((row) => row);',
            'export const rule = { create(context) { return {}; } };',
            'export const HEAD_LINES = 20;',
            'export default function audit(tree) {}',
        ].join('\n');

        // Then - nothing is named
        expect(exportedFunctions(text)).toStrictEqual([]);
    });
});
