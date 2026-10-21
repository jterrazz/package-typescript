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
    if (diff === undefined) {
        return undefined;
    }
    // Stryker disable next-line StringLiteral: git lists the untracked files of a tree it has just diffed
    const untracked = git(project, ['ls-files', '-z', '--others', '--exclude-standard']) ?? '';

    return `${diff}${untracked}`.split('\0').filter((path) => path !== '');
}

/** The tree of the commit a test run selects against, by which a proof of its green is keyed; empty outside a repository. */
export function branchBaseTreeOf(project: string): string {
    const base = branchBaseFor(project);

    // Stryker disable next-line StringLiteral,ConditionalExpression: git names the tree of every commit it named as the base, and none outside a repository, where the guard only spares the call
    return base === undefined ? '' : (git(project, ['rev-parse', `${base}^{tree}`])?.trim() ?? '');
}
