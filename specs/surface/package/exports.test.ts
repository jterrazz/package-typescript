import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import defaultExport, { oxfmt, oxlint } from '../../../dist/index.js';

const require = createRequire(import.meta.url);

const oxlintEntry = await import('../../../dist/oxlint.js');
const oxfmtEntry = await import('../../../dist/oxfmt.js');

// Self-reference resolution — the exports map must cover every consumer-facing subpath.
describe('exports', () => {
    test.each([
        '@jterrazz/typescript',
        '@jterrazz/typescript/config',
        '@jterrazz/typescript/docs',
        '@jterrazz/typescript/oxfmt',
        '@jterrazz/typescript/oxlint',
        '@jterrazz/typescript/oxlint-config-names',
        '@jterrazz/typescript/tsconfig/node',
        '@jterrazz/typescript/tsconfig/node.json',
        '@jterrazz/typescript/tsconfig/library',
        '@jterrazz/typescript/tsconfig/next',
        '@jterrazz/typescript/tsconfig/astro',
        '@jterrazz/typescript/tsconfig/expo',
        '@jterrazz/typescript/tsconfig/react',
        '@jterrazz/typescript/tsdown/build',
        '@jterrazz/typescript/tsdown/build.js',
        '@jterrazz/typescript/tsdown/bundle.js',
    ])('resolves %s', (specifier) => {
        // Given - a consumer-facing package subpath
        // Then - the specifier resolves to a real file
        expect(() => require.resolve(specifier)).not.toThrow();
    });

    test('the config-name list a sibling imports is the file the toolchain reads', () => {
        // Given - the list by its public specifier
        const exported = require.resolve('@jterrazz/typescript/oxlint-config-names');

        // Then - it is the one file check, fix and the drift report read, not a copy
        expect(exported).toBe(
            resolve(import.meta.dirname, '../../../lint/engine/project/oxlint-config-names.json'),
        );
    });

    test('the oxlint entry exports the six profiles, the layer-map builders and the nested form', () => {
        // Given - the tool-facing oxlint entry
        // Then - its surface is exactly what a consumer's config names
        expect(Object.keys(oxlintEntry).toSorted()).toStrictEqual([
            'HEXAGONAL_MAP',
            'astro',
            'bun',
            'compose',
            'defineConfig',
            'expo',
            'hexagonal',
            'layers',
            'nested',
            'next',
            'node',
            'react',
        ]);
    });

    test('the oxfmt entry exports the preset and the tool helper', () => {
        // Given - the tool-facing oxfmt entry
        // Then - nothing else crosses it
        expect(Object.keys(oxfmtEntry).toSorted()).toStrictEqual(['base', 'defineConfig']);
    });

    test('the barrel carries the same profiles the oxlint entry does', () => {
        // Given - the package barrel
        // Then - the two surfaces agree, and the default export repeats them
        expect(Object.keys(oxlint).toSorted()).toStrictEqual([
            'astro',
            'bun',
            'expo',
            'hexagonal',
            'nested',
            'next',
            'node',
            'react',
        ]);
        expect(oxlint.node).toStrictEqual(oxlintEntry.node);
        expect(oxfmt).toStrictEqual(oxfmtEntry.base);
        expect(defaultExport).toStrictEqual({ oxfmt, oxlint });
    });
});
