import { directory } from '@jterrazz/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { cli } from '../cli.specification.js';

describe('gated', () => {
    test('refuses to build while another live gate holds the checkout, and builds nothing', async () => {
        // Given - an application whose checkout this test's own process holds, which the build is no step of; a lock names a live process, so the ground cannot be a fixture
        const result = await cli
            .fixture(directory('../__fixtures__/sample-app/'))
            .prepare((workdir) => {
                mkdirSync(join(workdir, '.artifacts'), { recursive: true });
                writeFileSync(join(workdir, '.artifacts/gate.lock'), String(process.pid));
            })
            .exec('build');

        // Then - the four parts name the holder, and no dist/ is written
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toMatch(`
             TYPESCRIPT  Building the entries the manifest publishes...

            found: the gate of pid {{int}} holds this checkout (.artifacts/gate.lock) · why: a build replaces what a running gate reads (its build, its install), and the gate would judge a tree that changed under it · fix: wait for pid {{int}} to end, or run a build in a worktree of its own · read: docs/reference/quality-checks.md#one-gate-per-checkout
        `);
        expect(result.file('dist/index.js').exists).toBe(false);
    });
});
