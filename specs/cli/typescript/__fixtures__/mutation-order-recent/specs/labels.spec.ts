import { spawnSync } from 'node:child_process';
import { setTimeout as pause } from 'node:timers/promises';
import { expect, test } from 'vitest';

const labelOf = (name: string): string =>
    spawnSync(process.execPath, ['src/cli.ts', name], { encoding: 'utf8' }).stdout;

test('a name longer than three is long, one of three or fewer short, the slowest spec', async () => {
    await pause(1500);

    expect([labelOf('abcd'), labelOf('abc')]).toStrictEqual(['long\n', 'short\n']);
});
