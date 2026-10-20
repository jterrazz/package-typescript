import { spawnSync } from 'node:child_process';
import { expect, test } from 'vitest';

test('the command prints its label', () => {
    const run = spawnSync(process.execPath, ['src/cli.ts'], { encoding: 'utf8' });

    expect(run.stdout).toBe('label\n');
});
