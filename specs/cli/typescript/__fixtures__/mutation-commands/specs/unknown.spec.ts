import { spawnSync } from 'node:child_process';
import { expect, test } from 'vitest';

test('an unknown command prints the usage and fails', () => {
    const run = spawnSync(process.execPath, ['src/cli.ts', 'c'], { encoding: 'utf8' });

    expect([run.status, run.stdout]).toStrictEqual([1, 'usage: cli a|b\n']);
});
