import { spawnSync } from 'node:child_process';
import { expect, test } from 'vitest';

test('nothing costs nothing', () => {
    const run = spawnSync(process.execPath, ['src/cli.ts', '0'], { encoding: 'utf8' });

    expect(run.stdout).toBe('0\n');
});
