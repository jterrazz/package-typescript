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
export type Base = {
    commit: string;
    names: string;
    range: string;
    unmeasured?: string | undefined;
};

const short = (commit: string): string => commit.slice(0, 8);

// invariant: the default branch is the one `origin/HEAD` names, else `main`, else `master`; a clone that has none of them has no default branch to measure from.
function defaultBranchOf(project: string): string | undefined {
    const remote = git(project, [
        'symbolic-ref',
        '--quiet',
        '--short',
        'refs/remotes/origin/HEAD',
    ])?.trim();
    // Stryker disable next-line Regex: the name printed opens on the remote's, so anchoring the strip changes nothing a branch name could show
    const named = remote?.replace(/^origin\//u, '');

    // Stryker disable next-line ConditionalExpression,ArrayDeclaration: a name git did not print adds no candidate, and any text standing in for it names no branch the clone holds, so the search reaches main and master as it would have
    return [...(named === undefined ? [] : [named]), 'main', 'master'].find((branch) =>
        namesACommit(project, `refs/heads/${branch}`),
    );
}

// invariant: on the default branch itself the merge-base is HEAD, so the branch reads as having no commit of its own and the last commit is the change.
function branchBaseOf(project: string): undefined | { base: string; branch: string } {
    const branch = defaultBranchOf(project);
    // Stryker disable next-line ConditionalExpression,BlockStatement: a clone with no default branch asks git for a merge-base with the word `undefined`, which names no commit, and the answer is the same absent base
    if (branch === undefined) {
        return undefined;
    }
    const base = git(project, ['merge-base', branch, 'HEAD'])?.trim();
    // Stryker disable next-line OptionalChaining: a repository whose status answered resolves HEAD
    const head = git(project, ['rev-parse', 'HEAD'])?.trim();

    return base === undefined || base === head ? undefined : { base, branch };
}

/** The change a run measures when no commit is named: the uncommitted one against HEAD; on a clean tree, everything the branch holds beyond the default branch, or the last commit where HEAD is on the default branch; HEAD alone where there is no commit before it. */
export function defaultBaseOf(project: string): Base {
    const status = git(project, ['status', '--porcelain', '--untracked-files=all', '--', '.']);
    if (status !== '') {
        return {
            commit: 'HEAD',
            names: 'HEAD, the change not yet committed',
            range: 'HEAD..working tree',
        };
    }
    const branch = branchBaseOf(project);
    if (branch !== undefined) {
        return {
            commit: branch.base,
            names: `the merge-base with ${branch.branch} (${short(branch.base)}): the working tree is clean, so the branch's own commits are the change`,
            range: `${short(branch.base)}..HEAD`,
        };
    }
    const previous = git(project, ['rev-parse', '--verify', '--quiet', 'HEAD~1^{commit}'])?.trim();

    return previous === undefined
        ? {
              commit: 'HEAD',
              names: 'HEAD, the first commit, with no commit before it',
              range: 'HEAD..HEAD',
          }
        : {
              commit: previous,
              names: `the commit before HEAD (${short(previous)}): the working tree is clean, so the last commit is the change`,
              range: `${short(previous)}..HEAD`,
          };
}

/** The commits of the branch a base leaves out, `<merge-base>..<base>`, or `undefined` where the base reaches back to the merge-base with the default branch or the branch holds no commit of its own, so a verdict narrower than `merge-base..HEAD` can say what it did not measure. */
export function unmeasuredBy(project: string, since: Base): string | undefined {
    const branch = branchBaseOf(project);
    if (branch === undefined) {
        return undefined;
    }
    const reaches =
        git(project, ['merge-base', '--is-ancestor', since.commit, branch.base]) !== undefined;

    return reaches ? undefined : `${short(branch.base)}..${since.commit}`;
}

/** The commit a run measures from: the one named, else the default of the clone, with the commits of the branch that base leaves out. */
export function baseFor(project: string, named: string | undefined): Base {
    const base: Base =
        named === undefined
            ? defaultBaseOf(project)
            : { commit: named, names: named, range: `${named}..working tree` };

    return { ...base, unmeasured: unmeasuredBy(project, base) };
}

/** The tree of the commit a run measures the working tree against, by which a proof of its verdict is keyed whatever names that commit; a commit git cannot name is keyed by its name, and the run refuses it. */
export function baseTreeOf(project: string, named: string | undefined): string {
    const { commit } = baseFor(project, named);

    return git(project, ['rev-parse', `${commit}^{tree}`])?.trim() ?? `none ${commit}`;
}

/** What the working tree changed since `since`, untracked files whole, a file moved or renamed by its content (only the lines it changed beyond the move); `undefined` where git cannot say. */
export function changeSince(project: string, since: string): Changed | undefined {
    const diff = git(project, [
        'diff',
        '--unified=0',
        '--no-color',
        '--no-ext-diff',
        '-M',
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

/** The change both runs measure: what `--mutate` names, else what the tree changed since the base, with a note naming the base, or saying that git could not answer (`known` false: no line can be said changed) or that the change is empty, so a run that measured nothing says so. */
export function changeOf(
    project: string,
    { ranges, since }: { ranges: readonly string[] | undefined; since: Base },
): { changed: Changed; known: boolean; note?: string } {
    if (ranges !== undefined) {
        return { changed: linesNamed(ranges), known: true };
    }
    const changed = changeSince(project, since.commit);
    if (changed === undefined) {
        return {
            changed: new Map(),
            known: false,
            note: `git names no commit ${since.commit}: the module tests measure every source they test, whole, and the whole suite nothing of this change.`,
        };
    }

    return {
        changed,
        known: true,
        note:
            changed.size === 0
                ? `The working tree equals ${since.names}: no line changed, so neither run measures a change; name the commit the work started from with --since to measure one.`
                : `The change: the working tree against ${since.names}.`,
    };
}

/** The change that brings a static mutant to the suite: the tree's own, whatever lines `--mutate` names (a named file whole does not make its tables the suite's to judge); `changed` itself where nothing is named. */
export function treeChangeFor(
    project: string,
    { ranges, since }: { ranges: readonly string[] | undefined; since: Base },
    changed: Changed,
): Changed {
    return ranges === undefined ? changed : (changeSince(project, since.commit) ?? new Map());
}
