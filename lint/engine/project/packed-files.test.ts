import { describe, expect, test } from 'vitest';

import { isPacked } from './packed-files.js';

describe('packed-files', () => {
    test('a `!` entry takes back a file an entry above it ships, and a later entry can give it back', () => {
        // Given - a folder shipped, one chapter taken back, one chunk taken back then given again
        const files = ['dist', 'docs', '!docs/03-testing.md', '!dist/self*', 'dist/self-kept.js'];
        const targets = [
            'docs/01-architecture.md',
            'docs/03-testing.md',
            'dist/index.js',
            'dist/self.js',
            'dist/self-kept.js',
            'src/index.ts',
        ];

        // Then - what npm packs, path by path
        expect(targets.map((target) => [target, isPacked(files, target)])).toStrictEqual([
            ['docs/01-architecture.md', true],
            ['docs/03-testing.md', false],
            ['dist/index.js', true],
            ['dist/self.js', false],
            ['dist/self-kept.js', true],
            ['src/index.ts', false],
        ]);
    });
});
