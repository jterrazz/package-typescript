import { spawnSync } from 'node:child_process';
import { setTimeout as pause } from 'node:timers/promises';
import { expect, test } from 'vitest';

test('three costs six, the slowest spec', async () => {
    await pause(1500);
    const run = spawnSync(process.execPath, ['src/cli.ts', '3'], { encoding: 'utf8' });

    expect(run.stdout).toBe('6\n');
});
