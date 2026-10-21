import { spawnSync } from 'node:child_process';
import process from 'node:process';

const ENDED = new Set(['<defunct>', 'ps']);

/** The pids of the processes this one started and that still run: one that has ended waits to be reaped as `<defunct>`, and the listing is itself one. */
export const childProcesses = (): string[] =>
    spawnSync('ps', ['-A', '-o', 'pid=,ppid=,comm='], { encoding: 'utf8' })
        .stdout.split('\n')
        .map((row) => row.trim().split(/\s+/u))
        .filter(
            ([, parent, command]) =>
                parent === String(process.pid) && !ENDED.has(command?.split('/').at(-1) ?? ''),
        )
        .map(([pid]) => pid ?? '');
