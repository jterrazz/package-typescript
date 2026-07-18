import { expect, test } from 'vitest';

import { cli } from '../cli.specification.js';

test('runs the built application', async () => {
    // Given - a build followed by a start in the same working directory
    const result = await cli.fixture('$FIXTURES/sample-app/').exec(['build', 'start']);

    // Then - the whole build+start output matches (volatile sizes/durations tokenized)
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch('start.txt');
});

test('fails when dist does not exist', async () => {
    // Given - a project without a prior build step
    const result = await cli.fixture('$FIXTURES/sample-app/').exec('start');

    // Then - it exits with an error
    expect(result.exitCode).toBe(1);
});
