import { describe, expect, test } from 'vitest';

import { spec } from '../../setup/cli.specification.js';

describe('build', () => {
    test('builds successfully', async () => {
        // Given — sample app project
        const result = await spec('build').project('sample-app').exec('build').run();

        // Then — ESM build completes
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('Build completed');
    });

    test('generates ESM output with source content', async () => {
        // Given — sample app project
        const result = await spec('esm output').project('sample-app').exec('build').run();

        // Then — dist contains the app code
        expect(result.file('dist/index.js').exists).toBe(true);
        expect(result.file('dist/index.js').content).toContain('Hello from sample app');
    });

    test('does NOT generate CJS output', async () => {
        // Given — app build (not library bundle)
        const result = await spec('no cjs').project('sample-app').exec('build').run();

        // Then — no CommonJS file
        expect(result.file('dist/index.cjs').exists).toBe(false);
    });

    test('generates type declarations', async () => {
        // Given — sample app project
        const result = await spec('types').project('sample-app').exec('build').run();

        // Then — declaration file exists
        expect(result.file('dist/index.d.ts').exists).toBe(true);
    });

    test('generates source maps', async () => {
        // Given — sample app project
        const result = await spec('sourcemaps').project('sample-app').exec('build').run();

        // Then — source map exists
        expect(result.file('dist/index.js.map').exists).toBe(true);
    });

    test('fails on missing entry point', async () => {
        // Given — project with no src/ directory
        const result = await spec('missing entry').project('empty-app').exec('build').run();

        // Then — build fails with non-zero exit code
        expect(result.exitCode).not.toBe(0);
    });

    test('fails on unresolvable import', async () => {
        // Given — project with a missing module import
        const result = await spec('invalid ts').project('broken-app').exec('build').run();

        // Then — build fails and stderr contains error context
        expect(result.exitCode).not.toBe(0);
        expect(result.stderr).toContain('Error');
    });
});
