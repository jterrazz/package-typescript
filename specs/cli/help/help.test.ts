import { expect, test } from 'vitest';

import { cli } from '../cli.specification.js';

test('shows the full help banner when no command is provided', async () => {
    // Given - no command argument
    const result = await cli.exec('');

    // Then - the whole help surface (banner, usage, command list, examples) matches
    expect(result.stdout).toMatch('help.txt');
});

test('falls back to the help banner on an unknown command', async () => {
    // Given - an unrecognized command
    const result = await cli.exec('unknown');

    // Then - the same help surface is shown
    expect(result.stdout).toMatch('help.txt');
});
