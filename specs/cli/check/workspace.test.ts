import { describe, expect, test } from 'vitest';

import { cli } from '../cli.specification.js';

/*
 * Routed through the product command: `typescript check` measures each per-package
 * gate from the nearest package.json. In a workspace that means once per member —
 * a root that owns neither the specs nor the docs used to make both gates vanish.
 * grep is the scalpel: the pass banner and the offending member's own diagnostic.
 */

describe('conventions checker', () => {
    test("checks a member's specs root when the root owns none", async () => {
        // Given - a workspace whose only specs tree belongs to apps/api
        const result = await cli.fixture('workspace/').exec('check');

        // Then - the pass runs and reports the member's violation
        expect(result.stdout).toContain('Test Conventions');
        expect(result.stdout).toContain('bogusToken');
    });

    test('stays out of a member that does not depend on @jterrazz/test', async () => {
        // Given - the same layout with the dependency removed from the member
        const result = await cli.fixture('workspace-ungated/').exec('check');

        // Then - the gate is owned by the nearest package.json, so the pass never runs
        expect(result.stdout).not.toContain('Test Conventions');
        expect(result.stdout).not.toContain('bogusToken');
    });
});

describe('docs sync', () => {
    test("checks a member's committed docs when the root owns none", async () => {
        // Given - a workspace whose only docs projection belongs to packages/lib, and is stale
        const result = await cli.fixture('workspace-docs/').exec('check');

        // Then - the pass runs for the member and reports the drift
        expect(result.stdout).toContain('Docs (sync)');
        expect(result.stdout).toContain('out of sync');
    });
});
