import { spawnSync } from 'node:child_process';
import process from 'node:process';

// outside: `git ls-files` prints a whole tree on one stdout, past the 1 MiB Node buffers by default.
const OUTPUT_CAP_BYTES = 256 * 1024 * 1024;

/** How git ended for `args` in `cwd`, handed `input` on its stdin and `environment` beside the process's own: its status, and what it printed. */
export function gitRun(
    cwd: string,
    args: readonly string[],
    input?: string,
    environment?: Readonly<Record<string, string>>,
): { status: null | number; stdout: string } {
    const { status, stdout } = spawnSync('git', args, {
        cwd,
        encoding: 'utf8',
        env: { ...process.env, ...environment },
        input,
        maxBuffer: OUTPUT_CAP_BYTES,
    });

    return { status, stdout };
}

/** What git prints for `args` in `cwd`, handed `input` on its stdin and `environment` beside the process's own, or `undefined` where it fails. */
export function git(
    cwd: string,
    args: readonly string[],
    input?: string,
    environment?: Readonly<Record<string, string>>,
): string | undefined {
    const run = gitRun(cwd, args, input, environment);

    return run.status === 0 ? run.stdout : undefined;
}
