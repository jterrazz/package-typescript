/** One side of a hunk: its first line, from 1, and how many lines it holds. */
export type HunkSide = { count: number; from: number };

/** A hunk of a `git diff --unified=0`: the file its `+++` line names, and the lines it removes and adds. */
export type Hunk = { added: HunkSide; file: string; removed: HunkSide };

// outside: git writes a hunk's sides as `-<from>,<count>` and `+<from>,<count>`, and leaves the count out where it is one.
const HUNK =
    /^@@ -(?<removedFrom>\d+)(?:,(?<removedCount>\d+))? \+(?<addedFrom>\d+)(?:,(?<addedCount>\d+))? @@/u;

const B_SIDE = '+++ b/';

/** Every hunk of a `git diff --unified=0`, in order, each with the file of the `+++` line above it. */
export function hunksIn(diff: string): Hunk[] {
    const hunks: Hunk[] = [];
    // Stryker disable next-line StringLiteral: a hunk always follows the +++ line of its file, which names it first
    let file = '';
    for (const line of diff.split('\n')) {
        if (line.startsWith('+++ ')) {
            file = line.slice(B_SIDE.length);
            continue;
        }
        const sides = HUNK.exec(line)?.groups;
        if (sides !== undefined) {
            hunks.push({
                added: { count: Number(sides.addedCount ?? 1), from: Number(sides.addedFrom) },
                file,
                removed: {
                    count: Number(sides.removedCount ?? 1),
                    from: Number(sides.removedFrom),
                },
            });
        }
    }

    return hunks;
}
