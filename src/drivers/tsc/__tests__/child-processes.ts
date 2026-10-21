import { spawnSync } from 'node:child_process';
import process from 'node:process';

/** The pids of the processes this one started and that still run: one that has ended waits to be reaped in state `Z`, and the listing is itself one. */
export const childProcesses = (): string[] =>
    spawnSync('ps', ['-A', '-o', 'pid=,ppid=,stat=,comm='], { encoding: 'utf8' })
        .stdout.split('\n')
        .map((row) => row.trim().split(/\s+/u))
        .filter(
            ([, parent, state, command]) =>
                parent === String(process.pid) &&
                state?.startsWith('Z') !== true &&
                command?.split('/').at(-1) !== 'ps',
        )
        .map(([pid]) => pid ?? '');

/** The pids of the processes started since `before` was read that still run. */
export const startedSince = (before: readonly string[]): string[] =>
    childProcesses().filter((pid) => !before.includes(pid));
