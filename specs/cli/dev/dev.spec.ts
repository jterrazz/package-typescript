import { expect, test } from 'vitest';

import { cli } from '../cli.specification.js';

/*
 * A chain, not a document. The dev command is a long-running watch process resolved at a waitFor
 * marker: the stream is cut wherever the marker happened to land, so there is no byte-exact
 * stdout to state — and a document states one for every run it names. grep is the scalpel:
 * probe the specific banner/app markers we waited for.
 */

test('shows the startup message', async () => {
    // Given - dev mode on a sample app, resolved once the banner appears
    const result = await cli
        .fixture('$FIXTURES/sample-app/')
        .exec('dev', { timeout: 10_000, waitFor: 'Starting dev mode' });

    // Then - the banner and startup message appear
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('TYPESCRIPT');
    expect(result.stdout).toContain('Starting dev mode');
});

test('builds and runs the app in watch mode', async () => {
    // Given - dev mode on a sample app, resolved once the app output appears
    const result = await cli
        .fixture('$FIXTURES/sample-app/')
        .exec('dev', { timeout: 15_000, waitFor: 'Hello from sample app' });

    // Then - the app output appears (the build succeeded and the app ran)
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Hello from sample app');
});
