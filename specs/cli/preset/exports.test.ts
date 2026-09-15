import { createRequire } from 'node:module';
import { expect, test } from 'vitest';

import defaultExport, { oxfmt, oxlint } from '../../../src/index.js';

const require = createRequire(import.meta.url);

const oxlintEntry = await import('../../../src/oxlint.js');
const oxfmtEntry = await import('../../../src/oxfmt.js');

// Self-reference resolution — the exports map must cover every consumer-facing subpath.
test.each([
    '@jterrazz/typescript',
    '@jterrazz/typescript/docs',
    '@jterrazz/typescript/oxfmt',
    '@jterrazz/typescript/oxlint',
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
    '@jterrazz/typescript/presets/tsconfig/node',
    '@jterrazz/typescript/presets/tsconfig/node.json',
    '@jterrazz/typescript/presets/tsdown/bundle',
    '@jterrazz/typescript/presets/tsdown/bundle.js',
])('resolves %s', (specifier) => {
    // Given - a consumer-facing package subpath
    // Then - the specifier resolves to a real file
    expect(() => require.resolve(specifier)).not.toThrow();
});

test('the oxlint entry exports the seven profiles and the layer-map builders', () => {
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
        'library',
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
        'library',
        'next',
        'node',
        'react',
    ]);
    expect(oxlint.node).toStrictEqual(oxlintEntry.node);
    expect(oxfmt).toStrictEqual(oxfmtEntry.base);
    expect(defaultExport).toStrictEqual({ oxfmt, oxlint });
});
