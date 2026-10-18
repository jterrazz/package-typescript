import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';

import { readBaseline } from '../baseline-file.js';

const roots: string[] = [];

afterEach(() => {
    for (const root of roots.splice(0)) {
        rmSync(root, { force: true, recursive: true });
    }
});

function projectWithBaseline(text: string): string {
    const root = mkdtempSync(join(tmpdir(), 'baseline-file-'));
    roots.push(root);
    mkdirSync(join(root, '.jterrazz'));
    writeFileSync(join(root, '.jterrazz/baseline.json'), text);

    return root;
}

describe('baseline-file', () => {
    test('a baseline that is not JSON is its problem, with what the parser said, and holds no section', () => {
        // Given - a baseline file cut off mid-object
        const root = projectWithBaseline('{ "typescript": ');

        // Then - the problem names the parse failure, and no section is read
        const read = readBaseline(root);
        expect(read.sections).toBeNull();
        expect(read.problem).toMatch(/^is not JSON: \S/u);
    });
});
