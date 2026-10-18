import { describe, expect, test } from 'vitest';

import { cli as freshCloneCli } from '../fresh-clone.specification.js';

describe('fresh-clone-gated', () => {
    test('refuses to build a clone another live gate holds, and builds nothing', async () => {
        // Given - a fresh clone whose .artifacts/gate.lock names the live process that laid it
        const result = await freshCloneCli.exec('gated');

        // Then - the bootstrap refuses in the gate's words for a build, before tsdown writes dist/
        expect(result.exitCode).toBe(1);
        expect(result.stderr.text).toContain('or run a build in a worktree of its own');
        expect(result.stdout.text).toContain('built nothing');
    });
});
