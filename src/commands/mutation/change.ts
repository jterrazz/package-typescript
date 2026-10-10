import { git } from '../../../lint/kit/project/git.js';
import { fileOf } from './scope.js';
import type { Changed } from './survivors.js';

/** The lines a `git diff --unified=0` adds or rewrites, file by file, in the new side's numbering; a hunk that only deletes reaches no line, so neither does a file the diff deletes. */
export function hunksOf(diff: string): Map<string, [number, number][]> {
    const hunks = new Map<string, [number, number][]>();
    // Stryker disable next-line StringLiteral: a hunk always follows the +++ line of its file, which names it first
    let file = '';
    for (const line of diff.split('\n')) {
        if (line.startsWith('+++ ')) {
            file = line.slice('+++ b/'.length);
            continue;
        }
        const hunk = /^@@ -\d+(?:,\d+)? \+(?<from>\d+)(?:,(?<count>\d+))? @@/u.exec(line)?.groups;
        const count = Number(hunk?.count ?? 1);
        if (hunk !== undefined && count > 0) {
            const from = Number(hunk.from);
            hunks.set(file, [...(hunks.get(file) ?? []), [from, from + count - 1]]);
        }
    }

    return hunks;
}

/** Whether git, in the project, names `ref` as a commit. */
export const namesACommit = (project: string, ref: string): boolean =>
    git(project, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]) !== undefined;

/** The commit a run measures the working tree against when none is named, how the verdict names it, and the range it prints as the scope of the measure. */
export type Base = { commit: string; names: string; range: string };

const short = (commit: string): string => commit.slice(0, 8);

// invariant: the default branch is the one `origin/HEAD` names, else `main`, else `master`; a clone that has none of them has no default branch to measure from.
function defaultBranchOf(project: string): string | undefined {
    const remote = git(project, ['symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD'])
        ?.trim()
        .replace(/^origin\//u, '');

    return [remote, 'main', 'master'].find(
        (branch) => branch !== undefined && namesACommit(project, `refs/heads/${branch}`),
    );
}

function branchBaseOf(project: string): undefined | { base: string; branch: string } {
    const branch = defaultBranchOf(project);
    const current = git(project, ['rev-parse', '--abbrev-ref', 'HEAD'])?.trim();
    if (branch === undefined || current === branch) {
        return undefined;
    }
    const base = git(project, ['merge-base', branch, 'HEAD'])?.trim();
    const head = git(project, ['rev-parse', 'HEAD'])?.trim();

    return base === undefined || base === head ? undefined : { base, branch };
}

/** The change a run measures when no commit is named: the uncommitted one against HEAD; on a clean tree, everything the branch holds beyond the default branch, or the last commit where HEAD is on the default branch; HEAD alone where there is no commit before it. */
export function defaultBaseOf(project: string): Base {
    const status = git(project, ['status', '--porcelain', '--untracked-files=all', '--', '.']);
    if (status !== '') {
        return {
            commit: 'HEAD',
            names: 'HEAD — the change not yet committed',
            range: 'HEAD..working tree',
        };
    }
    const branch = branchBaseOf(project);
    if (branch !== undefined) {
        return {
            commit: branch.base,
            names: `the merge-base with ${branch.branch} (${short(branch.base)}) — the working tree is clean, so the branch's own commits are the change`,
            range: `${short(branch.base)}..HEAD`,
        };
    }
    const previous = git(project, ['rev-parse', '--verify', '--quiet', 'HEAD~1^{commit}'])?.trim();

    return previous === undefined
        ? {
              commit: 'HEAD',
              names: 'HEAD — the first commit, with no commit before it',
              range: 'HEAD..HEAD',
          }
        : {
              commit: previous,
              names: `the commit before HEAD (${short(previous)}) — the working tree is clean, so the last commit is the change`,
              range: `${short(previous)}..HEAD`,
          };
}

/** What the working tree changed since `since`, untracked files whole; `undefined` where git cannot say. */
export function changeSince(project: string, since: string): Changed | undefined {
    const diff = git(project, [
        'diff',
        '--unified=0',
        '--no-color',
        '--no-ext-diff',
        '--relative',
        since,
        '--',
        '.',
    ]);
    if (diff === undefined) {
        return undefined;
    }
    const changed: Map<string, [number, number][] | true> = hunksOf(diff);
    // Stryker disable next-line StringLiteral: git lists the untracked files of a tree it has just diffed
    const untracked = git(project, ['ls-files', '--others', '--exclude-standard']) ?? '';
    for (const file of untracked.split('\n').filter((one) => one !== '')) {
        changed.set(file, true);
    }

    return changed;
}

function linesNamed(ranges: readonly string[]): Changed {
    const named = new Map<string, [number, number][] | true>();
    for (const range of ranges) {
        const lines = /:(?<from>\d+)(?::\d+)?-(?<to>\d+)/u.exec(range)?.groups;
        const file = fileOf(range);
        const before = named.get(file) ?? [];
        named.set(
            file,
            lines === undefined || before === true
                ? true
                : [...before, [Number(lines.from), Number(lines.to)]],
        );
    }

    return named;
}

/** The change the suite measures: what `--mutate` names, else what the tree changed since the base, with a note naming the base, or saying that git could not answer or that the change is empty — a run that measured nothing says so. */
export function changeOf(
    project: string,
    { ranges, since }: { ranges: readonly string[] | undefined; since: Base },
): { changed: Changed; note?: string } {
    if (ranges !== undefined) {
        return { changed: linesNamed(ranges) };
    }
    const changed = changeSince(project, since.commit);
    if (changed === undefined) {
        return {
            changed: new Map(),
            note: `git names no commit ${since.commit}: the whole suite measures nothing of this change.`,
        };
    }

    return {
        changed,
        note:
            changed.size === 0
                ? `The working tree equals ${since.names}: no line changed, so the whole suite measures no change — name the commit the work started from with --since to measure one.`
                : `The change: the working tree against ${since.names}.`,
    };
}
