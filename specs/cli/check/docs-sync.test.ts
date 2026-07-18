import { expect, test } from 'vitest';

import { cli } from '../cli.specification.js';

/*
 * The Docs (sync) pass is opt-in: `typescript check` only adds it once a project
 * has generated its committed docs (docs/reference/ exists). It regenerates into
 * a temp dir and diffs the committed projections — the same logic as
 * `typescript docs --check`, sourced (not duplicated) from docs.sh.
 */

test('runs the Docs sync pass once the project has committed docs', async () => {
    // Given - a documented library whose docs are generated, then checked
    const result = await cli.fixture('$FIXTURES/sample-documented/').exec(['docs', 'check']);

    // Then - check adds a Docs (sync) pass to its parallel tool run
    expect(result.stdout).toContain('Docs (sync)');
});

test('omits the Docs sync pass when the project has no generated docs', async () => {
    // Given - the clean kitchen-sink project (no docs/reference)
    const result = await cli.fixture('kitchen-sink/').exec('check');

    // Then - the Docs pass is silently absent, like the conventions checker when ungated
    expect(result.exitCode).toBe(0);
    expect(result.stdout).not.toContain('Docs (sync)');
});
