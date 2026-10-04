import { spawnSync } from 'node:child_process';
import { expect, test } from 'vitest';

test('greets the name it is given', () => {
    const run = spawnSync(process.execPath, ['dist/greeting.ts', 'ada'], { encoding: 'utf8' });

    expect(run.stdout).toBe('hello, ada\n');
});
