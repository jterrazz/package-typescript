import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { keptByteForByte, verbatimRootsOf, verbatimTreesOf } from '../byte-for-byte.js';

describe('byte-for-byte', () => {
    test('verbatimRootsOf — the roots declared verbatim come first, then the platform’s verbatim tool roots, none twice, and a tree is a folder widened', () => {
        // Given - a section declaring a verbatim root, a root that is not, and a platform naming two tool roots, one of them declared too
        const section = {
            roots: {
                notes: { reason: 'quoted', verbatim: true },
                public: { reason: 'declared again', verbatim: true },
                scratch: { reason: 'laid out', verbatim: false },
            },
            verbatimToolRoots: ['public', 'assets'],
        };

        // Then - the declared roots, then the tool root not already there, as folders and as trees
        expect([verbatimRootsOf(section), verbatimTreesOf(section)]).toStrictEqual([
            ['notes', 'public', 'assets'],
            ['notes/**', 'public/**', 'assets/**'],
        ]);
    });

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
            '**/testdata/**',
            '**/*_test.go',
            'docs/upstream.md',
            'src/legacy/*.ts',
            'vendor/**',
            'reports/**',
            'research/**',
        ]);
    });

    test('keeps a tree once, however many of the sources name it', () => {
        // Given - a platform whose public folder is a content tree and a verbatim tool root, and a root declared verbatim twice over
        const section = {
            oxfmt: { ignore: { 'research/': 'quoted' } },
            roots: { research: { reason: 'quoted', verbatim: true } },
            verbatimToolRoots: ['public'],
        };

        // Then - public/** and research/** each stand once
        const kept = keptByteForByte(section);
        expect([
            kept.filter((glob) => glob === 'public/**').length,
            kept.filter((glob) => glob === 'research/**').length,
        ]).toStrictEqual([1, 1]);
    });

    test('widens a folder whose name holds a dot to its tree, and keeps as itself only a path whose last name carries an extension', () => {
        // Given - paths with a dot in a folder's name, in the middle of the path, and an extension on the last name
        const section = {
            oxfmt: {
                ignore: {
                    'docs/api.v2/notes': 'a folder under a dotted one',
                    'research.v2': 'a name that ends like an extension',
                    'v1.2-archive': 'a dot, then more than an extension',
                    'docs/api.v2/upstream.md': 'a file under a dotted folder',
                },
            },
        };

        // Then - the two folders as trees, the name that ends like an extension and the file as themselves
        expect(keptByteForByte(section).slice(-4)).toStrictEqual([
            'docs/api.v2/notes/**',
            'research.v2',
            'v1.2-archive/**',
            'docs/api.v2/upstream.md',
        ]);
    });

    test('lets the disk decide what a path names — a dot-folder or a versioned folder is widened, an extensionless file stands as itself', () => {
        // Given - a unit holding dot-folders, a versioned folder, an extensionless file and a file with an extension
        const unit = mkdtempSync(join(tmpdir(), 'byte-for-byte-'));
        try {
            mkdirSync(join(unit, '.claude'));
            mkdirSync(join(unit, 'docs/v1.2'), { recursive: true });
            writeFileSync(join(unit, 'Makefile'), '');
            writeFileSync(join(unit, 'LICENSE'), '');
            writeFileSync(join(unit, 'notes.md'), '');
            const section = {
                oxfmt: {
                    ignore: {
                        '.claude': 'a dot-folder',
                        'docs/v1.2': 'a versioned folder',
                        LICENSE: 'a file with no extension',
                        'generated/*': 'a glob with no extension',
                        Makefile: 'a file with no extension',
                        'notes.md': 'a file',
                    },
                },
            };

            // Then - the folders as trees, the files as themselves
            expect(keptByteForByte(section, unit).slice(-6)).toStrictEqual([
                '.claude/**',
                'docs/v1.2/**',
                'LICENSE',
                'generated/*',
                'Makefile',
                'notes.md',
            ]);
        } finally {
            rmSync(unit, { force: true, recursive: true });
        }
    });

    test('widens every root declared verbatim to its tree, whatever its name ends in', () => {
        // Given - roots declared verbatim named like a file
        const section = {
            roots: {
                '.storybook': { reason: 'tool output', verbatim: true },
                'docs/v1.2': { reason: 'frozen', verbatim: true },
            },
        };

        // Then - both are trees
        expect(verbatimTreesOf(section)).toStrictEqual(['.storybook/**', 'docs/v1.2/**']);
    });
});
