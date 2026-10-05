import { spawnSync } from 'node:child_process';

// outside: `git ls-files` prints a whole tree on one stdout, past the 1 MiB Node buffers by default.
const OUTPUT_CAP_BYTES = 256 * 1024 * 1024;

/** What git prints for `args` in `cwd`, handed `input` on its stdin, or `undefined` where it fails. */
export function git(cwd: string, args: readonly string[], input?: string): string | undefined {
    const run = spawnSync('git', args, {
        cwd,
        encoding: 'utf8',
        input,
        maxBuffer: OUTPUT_CAP_BYTES,
    });

    return run.status === 0 ? run.stdout : undefined;
}
