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

/** The lines `--mutate` names, file by file — a range of positions widened to its lines, a file named alone whole. */
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

/** The change the suite measures: what `--mutate` names, else what the tree changed since `since`, with a note when git could not say. */
export function changeOf(
    project: string,
    { ranges, since }: { ranges: readonly string[] | undefined; since: string },
): { changed: Changed; note?: string } {
    if (ranges !== undefined) {
        return { changed: linesNamed(ranges) };
    }
    const changed = changeSince(project, since);

    return changed === undefined
        ? {
              changed: new Map(),
              note: `git names no commit ${since}: the whole suite measures nothing of this change.`,
          }
        : { changed };
}
