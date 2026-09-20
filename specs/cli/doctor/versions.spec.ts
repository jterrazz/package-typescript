import { expect, test } from 'vitest';

import manifest from '../../../package.json' with { type: 'json' };
import { cli } from '../cli.specification.js';

/*
 * A chain, not a document: every number in this report is a version, and a
 * document stating one would be a golden that a dependency bump invalidates
 * without anything being wrong. What is claimed here is the shape and the
 * JOIN — the ranges the report prints are the ones package.json declares, and
 * the verdict column answers for every tool the toolchain runs.
 */

test('reports every tool of the toolchain against the range this package declares', async () => {
    // Given - the toolchain installed as this repository's own devDependencies
    const result = await cli.exec('doctor');

    // Then - the report names each tool the passes spawn, and node itself
    expect(result.exitCode).toBe(0);
    for (const tool of ['node', 'tsc (Go)', 'typescript', 'oxlint', 'oxfmt', 'knip']) {
        expect(result.stdout.toString()).toContain(tool);
    }

    // Then - the range beside each one is the range the manifest declares
    for (const name of ['knip', 'oxfmt', 'oxlint', 'oxlint-tsgolint', 'typescript'] as const) {
        expect(result.stdout.toString()).toContain(manifest.dependencies[name]);
    }
    expect(result.stdout.toString()).toContain(manifest.engines.node);

    // Then - nothing installed here is older than what the toolchain asks for
    expect(result.stdout.toString()).not.toContain('old');
    expect(result.stdout.toString()).not.toContain('absent');
    expect(result.stdout.toString()).toContain('Every tool is in range.');
});
