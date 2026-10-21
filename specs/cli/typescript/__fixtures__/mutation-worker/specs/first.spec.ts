import { spawnSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { expect, test } from 'vitest';

test('the first spec runs the command', () => {
    const run = spawnSync(process.execPath, ['src/cli.ts'], { encoding: 'utf8' });
    appendFileSync(String(process.env.WORKER_LOG), `spec ${String(process.env.__STRYKER_ACTIVE_MUTANT__)} ${String(process.pid)}\n`);

    expect(run.status).toBe(0);
});
