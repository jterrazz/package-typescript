import { execFileSync } from 'node:child_process';

/** Quiet: a spec reads what the binary prints, never git's own chatter. */
export function git(workdir: string, ...args: string[]): void {
    execFileSync('git', args, { cwd: workdir, stdio: 'ignore' });
}

/** A `.prepare()` step: the working directory becomes a repository whose index holds every file laid so far. */
export function repository(workdir: string): void {
    git(workdir, 'init', '--quiet');
    git(workdir, 'add', '.');
}

/** A `.prepare()` step: the working directory becomes a repository whose one commit holds every file laid so far. */
export function committed(workdir: string): void {
    repository(workdir);
    git(workdir, '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '--quiet', '-m', 'first');
}
