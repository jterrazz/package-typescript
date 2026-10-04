import { refusal } from '../../lint/kit/catalogue/lesson.js';
import { isList, objectOf, stringOf } from '../../lint/kit/project/json.js';

export type Survivor = {
    column: number;
    file: string;
    line: number;
    mutator: string;
    replacement: string;
};

export type Judged = {
    detected: number;
    outsideVerdict: Record<string, number>;
    survivors: Survivor[];
    uncoveredByFile: Record<string, number>;
    unrun: Record<string, number>;
};

const DETECTED: ReadonlySet<unknown> = new Set(['Killed', 'Timeout']);
const OUTSIDE_VERDICT: ReadonlySet<unknown> = new Set(['CompileError', 'Ignored', 'RuntimeError']);

function survivorOf(file: string, mutant: Record<string, unknown>): Survivor {
    const start = objectOf(objectOf(mutant.location).start);
    return {
        column: Number(start.column ?? 0),
        file,
        line: Number(start.line ?? 0),
        mutator: stringOf(mutant.mutatorName) ?? '',
        replacement: stringOf(mutant.replacement) ?? '',
    };
}

function tally(judged: Judged, file: string, mutant: Record<string, unknown>): void {
    const status = stringOf(mutant.status) ?? 'no status';
    if (DETECTED.has(status)) {
        judged.detected += 1;
    } else if (status === 'Survived') {
        judged.survivors.push(survivorOf(file, mutant));
    } else if (status === 'NoCoverage') {
        judged.uncoveredByFile[file] = (judged.uncoveredByFile[file] ?? 0) + 1;
    } else if (OUTSIDE_VERDICT.has(status)) {
        judged.outsideVerdict[status] = (judged.outsideVerdict[status] ?? 0) + 1;
    } else {
        judged.unrun[status] = (judged.unrun[status] ?? 0) + 1;
    }
}

/** A static mutant or a file outside `measured` is never judged: the incremental report keeps both from earlier runs. */
export function judgedReport(report: unknown, measured: ReadonlySet<string>): Judged {
    const judged: Judged = {
        detected: 0,
        outsideVerdict: {},
        survivors: [],
        uncoveredByFile: {},
        unrun: {},
    };
    for (const [file, entry] of Object.entries(objectOf(objectOf(report).files))) {
        if (!measured.has(file)) {
            continue;
        }
        const { mutants } = objectOf(entry);
        for (const mutant of isList(mutants) ? mutants.map((one) => objectOf(one)) : []) {
            if (mutant.static === true) {
                continue;
            }
            tally(judged, file, mutant);
        }
    }
    judged.survivors.sort(
        (a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.column - b.column,
    );
    return judged;
}

function countsOf(byStatus: Record<string, number>): { statuses: string; total: number } {
    const sorted = Object.entries(byStatus).toSorted(([a], [b]) => a.localeCompare(b));
    return {
        statuses: sorted.map(([status, count]) => `${status} ${count}`).join(', '),
        total: sorted.reduce((sum, [, count]) => sum + count, 0),
    };
}

function countLines({ outsideVerdict, uncoveredByFile }: Judged): string[] {
    const uncovered = Object.entries(uncoveredByFile).toSorted(
        ([a, left], [b, right]) => right - left || a.localeCompare(b),
    );
    const total = uncovered.reduce((sum, [, count]) => sum + count, 0);
    const outside = countsOf(outsideVerdict);
    return [
        `${total} mutant(s) no module test runs — the specs', measured by range: typescript mutation --specs --mutate <file>:<from>-<to>`,
        ...uncovered.map(([file, count]) => `  ${file}  ${count}`),
        ...(outside.total === 0
            ? []
            : [`${outside.total} mutant(s) outside the verdict — ${outside.statuses}`]),
    ];
}

function survivorLines({ survivors }: Judged): string[] {
    if (survivors.length === 0) {
        return [];
    }
    return [
        ...survivors.map(
            ({ column, file, line, mutator, replacement }) =>
                `${file}:${line}:${column}  ${mutator} → ${replacement.split('\n')[0] ?? ''}`,
        ),
        refusal({
            fix: 'assert what the line decides — a value compared whole kills most of them — or, where no change of the line can alter what the module does, declare it above the line: // Stryker disable next-line <mutator>: <why the mutant is equivalent>',
            found: `${survivors.length} mutant(s) a module test runs and none detects`,
            read: 'docs/reference/quality-checks.md#mutation',
            why: 'a test that runs a line and lets a change of it pass proves nothing of that line',
        }),
    ];
}

function unrunLines({ unrun }: Judged): string[] {
    const { statuses, total } = countsOf(unrun);
    if (total === 0) {
        return [];
    }
    return [
        refusal({
            fix: 'run `typescript mutation` again to its end — a run stopped midway leaves its mutants Pending, and the next one runs them',
            found: `${total} mutant(s) the run never judged — ${statuses}`,
            read: 'docs/reference/quality-checks.md#mutation',
            why: 'a mutant no test was run against says nothing of the line it mutates, so passing it would pass a run that judged nothing there',
        }),
    ];
}

export function verdictOf(judged: Judged): { lines: string[]; status: number } {
    const refused = [...survivorLines(judged), ...unrunLines(judged)];
    if (refused.length === 0) {
        return {
            lines: [
                `every mutant a module test runs is detected — ${judged.detected} detected`,
                ...countLines(judged),
            ],
            status: 0,
        };
    }
    return { lines: [...refused, ...countLines(judged)], status: 1 };
}
