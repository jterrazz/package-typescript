import { expect, test } from 'vitest';

import { cli } from '../cli.specification.js';

test('docs --check passes when a second generation is byte-identical', async () => {
    // Given - a generate immediately followed by a sync check in the same tree
    const result = await cli.fixture('$FIXTURES/sample-documented/').exec(['docs', 'docs --check']);

    // Then - the check is green: generation is deterministic, so nothing drifted
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Docs are in sync');
});

test('docs --check fails when a generated reference file was hand-edited', async () => {
    // Given - a synced docs tree with one reference file edited after generation
    const result = await cli
        .fixture('$FIXTURES/sample-documented/')
        .fixture('drift-reference/')
        .exec('docs --check');

    // Then - the check fails, names the reference tree, and points to regeneration
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain('out of sync');
    expect(result.stdout).toContain('docs/reference/');
    expect(result.stdout).toContain("Run 'typescript docs' to regenerate.");
});

test('docs errors on a project without a docs/ corpus', async () => {
    // Given - a library with a source barrel but no docs/ directory
    const result = await cli.fixture('$FIXTURES/sample-app/').exec('docs');

    // Then - generation refuses with a clear message
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('needs an entry barrel and a docs/ directory');
});

test('docs --check is a no-op for a project that owns no docs', async () => {
    // Given - the same no-docs library
    const result = await cli.fixture('$FIXTURES/sample-app/').exec('docs --check');

    // Then - nothing is owned, so the check passes silently
    expect(result.exitCode).toBe(0);
});
