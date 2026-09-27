import { objectOf, stringOf } from '../project/json.js';
import type { Counts } from './section.js';

const CHECKER_CODE = /^(?<pass>[\w-]+)\((?<rule>[^)]+)\)$/u;

function codesOf(report: unknown): string[] {
    const { diagnostics } = objectOf(report);

    return (Array.isArray(diagnostics) ? diagnostics : []).flatMap((entry) => {
        const code = stringOf(objectOf(entry).code) ?? '';
        const { pass, rule } = CHECKER_CODE.exec(code)?.groups ?? {};

        return pass === undefined || rule === undefined ? [] : [`${pass}/${rule}`];
    });
}

export function countsOf(...reports: unknown[]): Counts {
    const counts: Counts = {};
    for (const rule of reports.flatMap((report) => codesOf(report))) {
        counts[rule] = (counts[rule] ?? 0) + 1;
    }

    return counts;
}
