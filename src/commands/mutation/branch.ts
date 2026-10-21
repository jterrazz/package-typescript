import { git } from '../../../lint/kit/project/git.js';
import { branchBaseOf } from './change.js';

/** The commit a test run selects its files against, whatever the tree holds uncommitted: the merge-base with the default branch, or, on the default branch itself, the commit before HEAD; HEAD where there is none before it, and `undefined` outside a repository. */
export function branchBaseFor(project: string): string | undefined {
    const branch = branchBaseOf(project);
    if (branch !== undefined) {
        return branch.base;
    }

    return (
        git(project, ['rev-parse', '--verify', '--quiet', 'HEAD~1^{commit}'])?.trim() ??
        git(project, ['rev-parse', '--verify', '--quiet', 'HEAD^{commit}'])?.trim()
    );
}

/** The paths the working tree differs by from `since`, a file deleted or renamed away included, and every file git does not track yet; `undefined` where git cannot say. */
export function pathsChangedSince(project: string, since: string): string[] | undefined {
    const diff = git(project, [
        'diff',
        '--name-only',
        '--no-renames',
        '-z',
        '--relative',
        since,
        '--',
        '.',
    ]);
    const untracked = git(project, ['ls-files', '-z', '--others', '--exclude-standard']);
    if (diff === undefined || untracked === undefined) {
        return undefined;
    }

    return `${diff}${untracked}`.split('\0').filter((path) => path !== '');
}
