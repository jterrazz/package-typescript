import { spawnSync } from 'node:child_process';

/** What git prints for `args` in the project, or `undefined` where it fails. */
export function git(project: string, args: readonly string[]): string | undefined {
    const run = spawnSync('git', args, { cwd: project, encoding: 'utf8' });

    return run.status === 0 ? run.stdout : undefined;
}
