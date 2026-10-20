import { spawnSync } from 'node:child_process';
import { expect, test } from 'vitest';

test('a prints a', () => {
    const run = spawnSync(process.execPath, ['src/cli.ts', 'a'], { encoding: 'utf8' });

    expect(run.stdout).toBe('a\n');
});
