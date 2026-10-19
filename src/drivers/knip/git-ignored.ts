import { git } from '../../../lint/kit/project/git.js';

// outside: Knip reads a `.gitignore` only in the folders on the way to a workspace member, so a nested one elsewhere in a monorepo is never read and its files are reported unused; git honours every one.
export function gitIgnored(cwd: string): string[] {
    return (
        git(cwd, [
            'ls-files',
            '-z',
            '--others',
            '--ignored',
            '--exclude-standard',
            '--directory',
        ]) ?? ''
    )
        .split('\0')
        .filter((path) => path !== '')
        .map((path) => (path.endsWith('/') ? `${path}**` : path));
}
