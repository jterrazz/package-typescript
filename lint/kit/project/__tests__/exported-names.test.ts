import { describe, expect, test } from 'vitest';

import { exportedFunctions, exportedValues } from '../exported-names.js';

describe('exported-names', () => {
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
            'arrow',
            'bare',
            'typed',
            'ambient',
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

    test('names every value a module exports, bound or listed, and no function, re-export or default', () => {
        // Given - two bound values, a listed one, a function, a re-export and a default
        const text = [
            'export const rows = (Array.isArray(parsed) ? parsed : []).filter((row) => row);',
            'export const HEAD_LINES = 20;',
            'const WALK = { walked: ["lint"] };',
            'export { WALK as FRAGMENT_WALK };',
            'export const read = (path) => path;',
            "export { other } from './other.js';",
            'export default { rules: {} };',
        ].join('\n');

        // Then - the three values are named, under the names they are exported as
        expect(exportedValues(text)).toStrictEqual(['rows', 'HEAD_LINES', 'FRAGMENT_WALK']);
    });

    test('reads every declarator of a statement, an async arrow, a function and a class expression, and skips a pattern', () => {
        // Given - one statement binding a value and an async arrow, two expressions, and a destructured export, an ambient value and a second name for one
        const text = [
            'export const LIMIT = 3, run = async () => LIMIT;',
            'export const named = function () {};',
            'export const Shape = class {};',
            'export const { left, right } = pair;',
            'export declare const ambient: number;',
            'export { LIMIT as MAXIMUM };',
        ].join('\n');

        // Then - each binding is read by what it holds
        expect([exportedFunctions(text), exportedValues(text)]).toStrictEqual([
            ['run', 'named', 'Shape'],
            ['LIMIT', 'ambient', 'MAXIMUM'],
        ]);
    });

    test('names nothing a list exports as the default, nor a type it lists', () => {
        // Given - a local function and value listed as the default, and a type listed by name
        const text = [
            'function walk() {}',
            'const LIMIT = 3;',
            'type Tree = string;',
            'export { walk as default };',
            'export { LIMIT as default };',
            'export type { Tree };',
            'export default class {}',
            'function other() {}',
            "export { other } from './other.js';",
        ].join('\n');

        // Then - nothing is named
        expect([exportedFunctions(text), exportedValues(text)]).toStrictEqual([[], []]);
    });
});
