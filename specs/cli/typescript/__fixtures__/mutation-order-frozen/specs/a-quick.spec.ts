import { spawnSync } from 'node:child_process';
import { expect, test } from 'vitest';

test('the command runs, the quickest spec', () => {
    const run = spawnSync(process.execPath, ['src/cli.ts'], { encoding: 'utf8' });

    expect(run.status).toBe(0);
});
