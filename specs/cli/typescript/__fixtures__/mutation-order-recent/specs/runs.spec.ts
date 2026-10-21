import { spawnSync } from 'node:child_process';
import { expect, test } from 'vitest';

test('a name is labelled', () => {
    const run = spawnSync(process.execPath, ['src/cli.ts', 'abcd'], { encoding: 'utf8' });

    expect(run.status).toBe(0);
});
