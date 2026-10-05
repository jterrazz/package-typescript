import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, onTestFinished, test } from 'vitest';

import { readJsonc } from './jsonc.js';

function written(text: string): string {
    const directory = mkdtempSync(join(tmpdir(), 'jsonc-'));
    onTestFinished(() => {
        rmSync(directory, { force: true, recursive: true });
    });
    const path = join(directory, 'config.jsonc');
    writeFileSync(path, text);

    return path;
}

describe('readJsonc', () => {
    test('drops a trailing comma before the end of an array and of an object', () => {
        // Given - a document closing both collections after a comma
        const path = written('{\n    "ignore": ["a", "b",],\n    "nested": { "on": true, },\n}\n');

        // Then - it reads as the same document without them
        expect(readJsonc(path)).toStrictEqual({ ignore: ['a', 'b'], nested: { on: true } });
    });

    test('keeps a comment marker and a closing comma inside a string as data', () => {
        // Given - a string holding an escaped quote before `//`, and `,]` after it, beside a real comment
        const path = written('{\n    // the reason\n    "pattern": "a\\"//\\",]"\n}\n');

        // Then - the string reads back whole, and only the comment is gone
        expect(readJsonc(path)).toStrictEqual({ pattern: 'a"//",]' });
    });

    test('drops a block comment and a closing line comment, and keeps a value that ends a collection', () => {
        // Given - a block comment between two values, numbers closing an array, and a line comment with no newline after it
        const path = written('{ /* why */ "sizes": [1, 2], "max": 3 } // the end');

        // Then - only the comments are gone
        expect(readJsonc(path)).toStrictEqual({ max: 3, sizes: [1, 2] });
    });

    test('reads a stray comma after the document as no JSON object', () => {
        // Given - a document followed by a comma and blank lines
        const path = written('{ "a": 1 },\n\n');

        // Then - it is refused, not read as the object before it
        expect(() => readJsonc(path)).toThrow('Unexpected non-whitespace character after JSON');
    });

    test('reads a block comment to its own close, and one never closed to the end', () => {
        // Given - a comment whose opening slash could be read as its close, and one left open at the end
        const path = written('{ /*/ still a comment */ "a": 1 } /* left open');

        // Then - both are comments, whole
        expect(readJsonc(path)).toStrictEqual({ a: 1 });
    });
});
