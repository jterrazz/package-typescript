import { spawnSync } from 'node:child_process';
import { setTimeout as pause } from 'node:timers/promises';
import { expect, test } from 'vitest';

test('the command prints both numbers', async () => {
    await pause(500);
    const run = spawnSync(process.execPath, ['src/cli.ts'], { encoding: 'utf8' });

    expect(run.stdout).toBe('1 2\n');
});
