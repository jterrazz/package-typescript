import { describe, expect, test } from 'vitest';

import { runnerSlice, runnersOf } from '../concurrency.js';

const MB = 1024 ** 2;

const GB = 1024 ** 3;

describe('concurrency', () => {
    test('runnersOf — as many test runners as cpus where the memory holds them, each phase of the checker priced apart', () => {
        // Given - runners at 500 MB and checkers at 400 MB, on slices where the cpus bind, where the running phase binds, where only the checking phase binds, and with no checker
        const prices = { checker: 400 * MB, runner: 500 * MB, tool: 0 };
        // Then - three runners and two checkers; two runners in 1 GB; two where 1.5 GB holds three runners but not two 900 MB checkers beside one; four with no checker; one where nothing fits; a memory filled exactly by the runners, or by the checking phase, holds them; 2 GB holds two 900 MB checkers beside one runner, never beside nothing
        expect([
            runnersOf({ cpus: 3, memory: 64 * GB }, prices),
            runnersOf({ cpus: 16, memory: GB }, prices),
            runnersOf(
                { cpus: 3, memory: 1500 * MB },
                { checker: 900 * MB, runner: 500 * MB, tool: 0 },
            ),
            runnersOf(
                { cpus: 4, memory: 2 * GB },
                { checker: undefined, runner: 500 * MB, tool: 0 },
            ),
            runnersOf({ cpus: 4, memory: 0 }, prices),
            runnersOf(
                { cpus: 3, memory: 1500 * MB },
                { checker: undefined, runner: 500 * MB, tool: 0 },
            ),
            runnersOf(
                { cpus: 2, memory: 1400 * MB },
                { checker: 900 * MB, runner: 500 * MB, tool: 0 },
            ),
            runnersOf(
                { cpus: 3, memory: 2000 * MB },
                { checker: 900 * MB, runner: 500 * MB, tool: 0 },
            ),
        ]).toStrictEqual([
            { binds: 'cpus', checkers: 2, runners: 3 },
            { binds: 'memory', checkers: 1, runners: 2 },
            { binds: 'memory', checkers: 1, runners: 2 },
            { binds: 'cpus', checkers: 0, runners: 4 },
            { binds: 'memory', checkers: 1, runners: 1 },
            { binds: 'cpus', checkers: 0, runners: 3 },
            { binds: 'cpus', checkers: 1, runners: 2 },
            { binds: 'memory', checkers: 1, runners: 2 },
        ]);
    });

    test('runnersOf — Stryker’s own process is held once, beside the runners and beside the checking phase alike', () => {
        // Given - Stryker at 300 MB with runners at 500 MB, in 1.3 GB and 1.299 GB with no checker, and with 900 MB checkers in 2.3 GB and 2.299 GB
        const tool = 300 * MB;

        // Then - two runners where the memory holds Stryker beside them, one a megabyte short; the checking phase likewise
        expect([
            runnersOf(
                { cpus: 4, memory: 1300 * MB },
                { checker: undefined, runner: 500 * MB, tool },
            ),
            runnersOf(
                { cpus: 4, memory: 1299 * MB },
                { checker: undefined, runner: 500 * MB, tool },
            ),
            runnersOf(
                { cpus: 2, memory: 1700 * MB },
                { checker: 900 * MB, runner: 500 * MB, tool },
            ),
            runnersOf(
                { cpus: 2, memory: 1699 * MB },
                { checker: 900 * MB, runner: 500 * MB, tool },
            ),
        ]).toStrictEqual([
            { binds: 'memory', checkers: 0, runners: 2 },
            { binds: 'memory', checkers: 0, runners: 1 },
            { binds: 'cpus', checkers: 1, runners: 2 },
            { binds: 'memory', checkers: 1, runners: 1 },
        ]);
    });

    test('runnerSlice — each test runner hands on its share of the cpus, never none, and of the memory its runners leave, never none', () => {
        // Given - ten cpus and 5 GB shared by four runners at 1 GB, two cpus and 3 GB by three at 512 MB beside Stryker at 1.5 GB, and 2 GB that two runners at 1 GB fill
        // Then - two cpus and a quarter of what is left each, one cpu and a third of what Stryker leaves less a runner, and one cpu and a megabyte where nothing is left
        expect([
            runnerSlice({ cpus: 10, memory: 5 * GB }, 4, { tool: 0, worker: GB }),
            runnerSlice({ cpus: 2, memory: 3 * GB }, 3, { tool: 1.5 * GB, worker: 256 * MB }),
            runnerSlice({ cpus: 2, memory: 2 * GB }, 2, { tool: 0, worker: GB }),
        ]).toStrictEqual([
            { cpus: 2, memory: 0.25 * GB },
            { cpus: 1, memory: 256 * MB },
            { cpus: 1, memory: MB },
        ]);
    });
});
