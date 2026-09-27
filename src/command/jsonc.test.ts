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
});
