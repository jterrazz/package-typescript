import { describe, expect, test } from 'vitest';

import { keptByteForByte } from '../byte-for-byte.js';

describe('keptByteForByte', () => {
    test('keeps the content trees, the ground, the paths handed the formatter and the roots declared verbatim, each folder as its whole tree and each file as itself', () => {
        // Given - a section handing the formatter a folder, a glob and a file, and declaring three roots, two of them verbatim
        const section = {
            oxfmt: {
                ignore: {
                    'docs/upstream.md': 'kept as quoted',
                    'src/legacy/*.ts': 'kept as vendored',
                    vendor: 'kept as shipped',
                },
            },
            roots: {
                notes: 'kept beside the spine, rewritten like any other',
                reports: { reason: 'the weekly report its script writes', verbatim: true },
                research: { reason: 'quoted upstream text', verbatim: true },
                scratch: { reason: 'a folder the formatter still lays out', verbatim: false },
            },
        };

        // Then - the trees every unit keeps, then the declared paths, a folder widened to its tree and a glob as written
        expect(keptByteForByte(section)).toStrictEqual([
            'dist/**',
            'assets/**',
            'public/**',
            '.next/**',
            '.expo/**',
            '**/__expected__/**',
            '**/__fixtures__/**',
            '**/__requests__/**',
            '**/__seeds__/**',
            'docs/upstream.md',
            'src/legacy/*.ts',
            'vendor/**',
            'reports/**',
            'research/**',
        ]);
    });
});
