import { spawnSync } from 'node:child_process';
import { setTimeout as pause } from 'node:timers/promises';
import { expect, test } from 'vitest';

test('the command runs, the slowest spec', async () => {
    await pause(1500);
    const run = spawnSync(process.execPath, ['src/cli.ts'], { encoding: 'utf8' });

    expect(run.status).toBe(0);
});
