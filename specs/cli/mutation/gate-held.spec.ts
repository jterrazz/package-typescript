import { directory } from '@jterrazz/test';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { cli } from '../cli.specification.js';

describe('gate-held', () => {
    test('takes over a lock its dead holder left, and gives it back when it ends', async () => {
        // Given - a project with nothing to mutate whose lock a process that has exited left — a lock names a process, so the ground cannot be a fixture
        const result = await cli
            .fixture(directory('../__fixtures__/names/empty-directories/'))
            .prepare((workdir) => {
                mkdirSync(join(workdir, '.artifacts'), { recursive: true });
                writeFileSync(
                    join(workdir, '.artifacts/gate.lock'),
                    String(spawnSync(process.execPath, ['--eval', '']).pid),
                );
            })
            .exec('mutation');

        // Then - the run ends with no lock left
        expect(result.exitCode).toBe(0);
        expect(result.file('.artifacts/gate.lock').exists).toBe(false);
    });
});
