import { spawnSync } from 'node:child_process';
import { expect, test } from 'vitest';

test('no command prints the usage', () => {
    const run = spawnSync(process.execPath, ['src/cli.ts'], { encoding: 'utf8' });

    expect([run.status, run.stdout]).toStrictEqual([0, 'usage: cli a|b\n']);
});
