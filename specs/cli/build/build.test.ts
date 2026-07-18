import { expect, test } from 'vitest';

import { cli } from '../cli.specification.js';

test('builds an application successfully', async () => {
    // Given - a sample application project
    const result = await cli.fixture('$FIXTURES/sample-app/').exec('build');

    // Then - the whole build output matches (volatile sizes/durations tokenized)
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch('build.txt');
});

test('emits the ESM artifact set', async () => {
    // Given - a sample application project built once
    const result = await cli.fixture('$FIXTURES/sample-app/').exec('build');

    // Then - dist holds ESM code (carrying the source), a declaration, and a source map, but no CJS
    expect(result.file('dist/index.js').exists).toBe(true);
    expect(result.file('dist/index.js').content).toContain('Hello from sample app');
    expect(result.file('dist/index.d.ts').exists).toBe(true);
    expect(result.file('dist/index.js.map').exists).toBe(true);
    expect(result.file('dist/index.cjs').exists).toBe(false);
});

test('fails on a missing entry point', async () => {
    // Given - a project with no src/ directory
    const result = await cli.fixture('$FIXTURES/empty-app/').exec('build');

    // Then - the build fails with a non-zero exit code
    expect(result.exitCode).not.toBe(0);
});

test('fails on an unresolvable import', async () => {
    // Given - a project with a missing module import
    const result = await cli.fixture('$FIXTURES/broken-app/').exec('build');

    // Then - the build fails and stderr carries error context
    expect(result.exitCode).not.toBe(0);
    // Scalpel: probe the bundler's own error text, not snapshotted (couples to tsdown/rolldown formatting)
    expect(result.stderr).toContain('Error');
});
