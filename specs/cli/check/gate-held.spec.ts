import { directory } from '@jterrazz/test';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { onlyPasses } from '../__setup__/check-passes.js';
import { cli } from '../cli.specification.js';

// invariant: the ground cannot be a fixture: the lock names a process, and only a process of this run is known to be alive, or dead, while the command runs.
function lockedBy(pid: number): (workdir: string) => void {
    return (workdir) => {
        mkdirSync(join(workdir, '.artifacts'), { recursive: true });
        writeFileSync(join(workdir, '.artifacts/gate.lock'), String(pid));
    };
}

const config = cli
    .with({ env: onlyPasses('config') })
    .fixture(directory('../__fixtures__/sample-app/'));

describe('gate-held', () => {
    test('takes over a lock its dead holder left, holds it while it runs, and gives it back when it ends', async () => {
        // Given - an application whose lock a process that has exited left
        const result = await config
            .prepare(lockedBy(spawnSync(process.execPath, ['--eval', '']).pid))
            .exec('check');

        // Then - the run ends with no lock left
        expect(result.file('.artifacts/gate.lock').exists).toBe(false);
    });

    test('runs under a lock another live gate holds, and leaves the lock to it', async () => {
        // Given - an application this test's own process holds, which the check is no step of
        const result = await config.prepare(lockedBy(process.pid)).exec('check');

        // Then - the lock still names that process
        expect(result.file('.artifacts/gate.lock').content).toBe(String(process.pid));
    });
});
