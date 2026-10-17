import { directory } from '@jterrazz/test';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { onlyPasses } from '../__setup__/check-passes.js';
import { cli } from '../cli.specification.js';

describe('gate-held', () => {
    test('holds no lock: one its dead holder left stays as it was', async () => {
        // Given - an application whose lock a process that has exited left — a lock names a process, so the ground cannot be a fixture
        const dead = String(spawnSync(process.execPath, ['--eval', '']).pid);
        const result = await cli
            .with({ env: onlyPasses('config') })
            .fixture(directory('../__fixtures__/sample-app/'))
            .prepare((workdir) => {
                mkdirSync(join(workdir, '.artifacts'), { recursive: true });
                writeFileSync(join(workdir, '.artifacts/gate.lock'), dead);
            })
            .exec('fix');

        // Then - the lock is the one it found
        expect(result.file('.artifacts/gate.lock').content).toBe(dead);
    });
});
