import { expect, test } from 'vitest';

import { cli } from '../cli.specification.js';

test('bundles a library successfully', async () => {
    // Given - a sample library project
    const result = await cli.fixture('$FIXTURES/sample-lib/').exec('bundle');

    // Then - the bundle completes
    /*
     * Scalpel (not a golden): tsdown emits the CJS and ESM format blocks concurrently,
     * so their line ordering interleaves non-deterministically run to run — a full
     * snapshot is unstable by nature. Probe the completion marker instead.
     */
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Build completed');
});

test('generates ESM output with export statements', async () => {
    // Given - a sample library project
    const result = await cli.fixture('$FIXTURES/sample-lib/').exec('bundle');

    // Then - the ESM module carries exports
    expect(result.file('dist/index.js').exists).toBe(true);
    expect(result.file('dist/index.js').content).toContain('export');
});

test('generates CJS output with exports', async () => {
    // Given - a sample library project
    const result = await cli.fixture('$FIXTURES/sample-lib/').exec('bundle');

    // Then - the CommonJS module carries exports
    expect(result.file('dist/index.cjs').exists).toBe(true);
    expect(result.file('dist/index.cjs').content).toContain('exports');
});

test('generates type declarations exposing the public API', async () => {
    // Given - a sample library project
    const result = await cli.fixture('$FIXTURES/sample-lib/').exec('bundle');

    // Then - the declaration file exposes all public types
    expect(result.file('dist/index.d.ts').exists).toBe(true);
    expect(result.file('dist/index.d.ts').content).toContain('greet');
    expect(result.file('dist/index.d.ts').content).toContain('User');
});

test('generates source maps for both formats', async () => {
    // Given - a sample library project
    const result = await cli.fixture('$FIXTURES/sample-lib/').exec('bundle');

    // Then - both ESM and CJS carry source maps
    expect(result.file('dist/index.js.map').exists).toBe(true);
    expect(result.file('dist/index.cjs.map').exists).toBe(true);
});

test('fails on a missing entry point', async () => {
    // Given - a project with no src/ directory
    const result = await cli.fixture('$FIXTURES/empty-app/').exec('bundle');

    // Then - the bundle fails with a non-zero exit code
    expect(result.exitCode).not.toBe(0);
});

test('fails on an unresolvable import', async () => {
    // Given - a project with a missing module import
    const result = await cli.fixture('$FIXTURES/broken-app/').exec('bundle');

    // Then - the bundle fails with a non-zero exit code
    expect(result.exitCode).not.toBe(0);
});
