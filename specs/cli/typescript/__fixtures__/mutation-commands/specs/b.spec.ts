import { spawnSync } from 'node:child_process';
import { setTimeout as pause } from 'node:timers/promises';
import { expect, test } from 'vitest';

test('b prints its label, the slowest spec', async () => {
    await pause(1500);
    const run = spawnSync(process.execPath, ['src/cli.ts', 'b'], { encoding: 'utf8' });

    expect(run.stdout).toBe('bee\n');
});
