export type MemberRun = { args: string[]; member: string };

/** Each member a run measures, and the command line it is measured with: the root's `--since`, `--cold` and `--report`, and the `--mutate` ranges that sit in it, named from its folder. A member no range names is not run. */
export function memberRuns(
    members: readonly string[],
    {
        cold,
        ranges,
        report,
        since,
    }: {
        cold: boolean;
        ranges: readonly string[] | undefined;
        report?: string | undefined;
        since: string | undefined;
    },
): MemberRun[] {
    const sinceArgs = [
        ...(since === undefined ? [] : ['--since', since]),
        ...(cold ? ['--cold'] : []),
        ...(report === undefined ? [] : ['--report', report]),
    ];

    return members.flatMap((member): MemberRun[] => {
        if (ranges === undefined) {
            return [{ args: sinceArgs, member }];
        }
        const prefix = `${member}/`;
        const own = ranges
            .filter((range) => range.startsWith(prefix))
            .map((range) => range.slice(prefix.length));

        return own.length === 0
            ? []
            : [{ args: [...sinceArgs, '--mutate', own.join(',')], member }];
    });
}

/** The first `--mutate` range that sits in no member of the workspace, else `undefined`. */
export const unownedRange = (
    members: readonly string[],
    ranges: readonly string[],
): string | undefined =>
    ranges.find((range) => !members.some((member) => range.startsWith(`${member}/`)));
