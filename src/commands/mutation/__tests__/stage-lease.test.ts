import { clock } from '@jterrazz/test';
import {
    existsSync,
    mkdtempSync,
    readFileSync,
    realpathSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import { availableParallelism, tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { describe, expect, onTestFinished, test, vi } from 'vitest';

import { CAPACITY_VARIABLE, PRICES_FILE } from '../../../../lint/kit/project/capacity.js';
import { leasedRun, peakPriced, sliceNow, stageLease, withCapacityHanded } from '../stage-lease.js';

const MB = 1024 ** 2;

const GB = 1024 ** 3;

function project(typeChecked: boolean): string {
    const fresh = mkdtempSync(join(tmpdir(), 'stage-lease-'));
    const root = realpathSync(fresh);
    onTestFinished(() => {
        rmSync(root, { force: true, recursive: true });
    });
    if (typeChecked) {
        writeFileSync(join(root, 'tsconfig.json'), '{}');
    }

    return root;
}

function variableIs(value: string | undefined): void {
    vi.stubEnv(CAPACITY_VARIABLE, value);
    onTestFinished(() => {
        vi.unstubAllEnvs();
    });
}

describe('stage-lease', () => {
    test('stageLease — a type-checked suite stage given 3 cpus and 64 GB runs three runners and two checkers, each runner handing on its third', () => {
        // Given - a project that keeps a tsconfig.json, its suite stage given a capacity whole
        const root = project(true);

        // Then - the cpus bind, the checkers are counted, and each runner hands on one cpu and a third of 56 GB
        expect(stageLease({ cpus: 3, memory: 64 * GB }, root, 'suite')).toStrictEqual({
            handed: { cpus: 1, memory: Math.floor((56 * GB) / 3) },
            line: 'capacity: 3 cpus, 64.0 GB, given by TYPESCRIPT_CAPACITY: this gate 3 cpus, 56.0 GB · 3 test runner(s) at 500 MB, 2 checker(s) at 400 MB while checking: cpus bind',
            pool: 'stryker-suite',
            runners: 3,
        });
    });

    test('stageLease — a module stage with no compilation given 1 GB runs what its memory holds, and no checker', () => {
        // Given - a project that keeps no tsconfig.json, its module stage given 16 cpus and 1 GB
        const root = project(false);

        // Then - 896 MB holds two 300 MB runners, the memory binds, and no checker is named
        expect(stageLease({ cpus: 16, memory: GB }, root, 'modules')).toStrictEqual({
            handed: { cpus: 8, memory: 448 * MB },
            line: 'capacity: 16 cpus, 1.0 GB, given by TYPESCRIPT_CAPACITY: this gate 16 cpus, 0.9 GB · 2 test runner(s) at 300 MB: memory binds',
            pool: 'stryker-modules',
            runners: 2,
        });
    });

    test('sliceNow — a machine no other gate leases is this gate’s whole', () => {
        // Given - a machine of its own, with no lease on it
        vi.stubEnv('TMPDIR', project(false));
        onTestFinished(() => {
            vi.unstubAllEnvs();
        });

        // Then - every cpu Node counts, one gate
        expect(sliceNow(undefined, project(false))).toMatchObject({
            cpus: availableParallelism(),
            gates: 1,
        });
    });

    test('peakPriced — a peak shared by the stage’s runners becomes its pool’s price; no peak, or none above nothing, teaches none', () => {
        // Given - a stage of three suite runners whose processes peaked at 1.2 GB, and two that read nothing
        const root = project(false);
        const lease = {
            handed: { cpus: 1, memory: GB },
            line: '',
            pool: 'stryker-suite',
            runners: 3,
        } as const;
        peakPriced(root, lease, undefined);
        peakPriced(root, lease, 0);
        const before = existsSync(join(root, PRICES_FILE));
        peakPriced(root, lease, 1200 * MB);
        const written: unknown = JSON.parse(readFileSync(join(root, PRICES_FILE), 'utf8'));

        // Then - nothing was written for the first two, then 400 MB per runner
        expect([before, written]).toStrictEqual([false, { 'stryker-suite': [400 * MB] }]);
    });

    test('withCapacityHanded — the run reads the slice handed; the variable is taken away after, or given back as it was, a failure included', async () => {
        // Given - the variable unset, then set, around runs that read it, one of which fails
        variableIs(undefined);
        const unset = await withCapacityHanded({ cpus: 2, memory: GB }, async () => {
            await Promise.resolve();

            return process.env[CAPACITY_VARIABLE];
        });
        const afterUnset = CAPACITY_VARIABLE in process.env;
        variableIs('cpus=9');
        await expect(
            withCapacityHanded({ cpus: 1, memory: GB }, async () => {
                await Promise.resolve();
                throw new Error('stopped');
            }),
        ).rejects.toThrow('stopped');

        // Then - the run read the slice, nothing was left after the first, and the second found its value again
        expect([unset, afterUnset, process.env[CAPACITY_VARIABLE]]).toStrictEqual([
            'cpus=2,memory=1024m',
            false,
            'cpus=9',
        ]);
    });

    test('leasedRun — the run reads its runners’ slice, answers or fails as it does, and leaves no watch behind', async () => {
        // Given - a lease on a project, a run that answers with the variable it reads, and one that fails, under a pinned scheduler
        using _ = clock.run('2026-10-20T00:00:00Z');
        variableIs(undefined);
        const lease = {
            handed: { cpus: 2, memory: GB },
            line: '',
            pool: 'stryker-modules',
            runners: 1,
        } as const;
        const root = project(false);
        const read = await leasedRun(root, lease, async () => {
            await Promise.resolve();

            return process.env[CAPACITY_VARIABLE];
        });
        const failed = leasedRun(root, lease, async () => {
            await Promise.resolve();
            throw new Error('stopped');
        });

        // Then - the slice was handed, the failure reaches the caller, and no timer is left
        await expect(failed).rejects.toThrow('stopped');
        expect([read, vi.getTimerCount()]).toStrictEqual(['cpus=2,memory=1024m', 0]);
    });
});
