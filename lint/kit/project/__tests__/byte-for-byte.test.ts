import { describe, expect, test } from 'vitest';

import { keptByteForByte } from '../byte-for-byte.js';

describe('keptByteForByte', () => {
    test('keeps the content trees, the ground, the paths handed the formatter and the roots a script writes, each folder as its whole tree', () => {
        // Given - a section handing the formatter a folder and a glob, and declaring a generated root
        const section = {
            generated: { reports: 'the weekly report its script writes' },
            oxfmt: { ignore: { 'src/legacy/*.ts': 'kept as vendored', vendor: 'kept as shipped' } },
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
            'src/legacy/*.ts',
            'vendor/**',
            'reports/**',
        ]);
    });
});
