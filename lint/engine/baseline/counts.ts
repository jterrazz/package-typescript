import { objectOf, stringOf } from '../project/json.js';
import type { Counts } from './section.js';

export function countsOf(findings: readonly { rule: string }[]): Counts {
    const counts: Counts = {};
    for (const { rule } of findings) {
        counts[rule] = (counts[rule] ?? 0) + 1;
    }

    return counts;
}

export function reportedCounts(...reports: unknown[]): Counts {
    return countsOf(
        reports.flatMap((report) =>
            (Array.isArray(report) ? report : []).flatMap((row) => {
                const rule = stringOf(objectOf(row).rule);

                return rule === null ? [] : [{ rule }];
            }),
        ),
    );
}
