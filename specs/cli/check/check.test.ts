import { expect, test } from 'vitest';

import { cli } from '../cli.specification.js';

/*
 * The kitchen-sink: one clean project that satisfies every tool, snapshotted as a
 * whole-surface golden file. This is the regression net for the combined output of
 * the product command (banners, per-tool sections, pass markers). It is expected to
 * churn when the check pipeline changes. Volatile bits (durations, thread counts)
 * are covered by {{duration}} / {{number}} tokens.
 */

test('runs the four quality tools and passes on a clean project', async () => {
    // Given - a clean kitchen-sink project that satisfies every tool
    const result = await cli.fixture('kitchen-sink/').exec('check');

    // Then - the full combined output matches the whole-surface snapshot
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch('check.txt');
});

test('reports the quality fixes surface', async () => {
    // Given - the same clean project run through fix
    const result = await cli.fixture('kitchen-sink/').exec('fix');

    // Then - the fix surface matches its snapshot
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch('fix.txt');
});
