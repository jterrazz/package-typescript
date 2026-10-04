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
};

const DETECTED: ReadonlySet<unknown> = new Set(['Killed', 'Timeout']);

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

/** A static mutant or a file outside `measured` is never judged: the incremental report keeps both from earlier runs. */
export function judgedReport(report: unknown, measured: ReadonlySet<string>): Judged {
    const judged: Judged = { detected: 0, outsideVerdict: {}, survivors: [], uncoveredByFile: {} };
    for (const [file, entry] of Object.entries(objectOf(objectOf(report).files))) {
        if (!measured.has(file)) {
            continue;
        }
        const { mutants } = objectOf(entry);
        for (const mutant of isList(mutants) ? mutants.map((one) => objectOf(one)) : []) {
            if (mutant.static === true) {
                continue;
            }
            const status = stringOf(mutant.status) ?? 'no status';
            if (DETECTED.has(status)) {
                judged.detected += 1;
            } else if (status === 'Survived') {
                judged.survivors.push(survivorOf(file, mutant));
            } else if (status === 'NoCoverage') {
                judged.uncoveredByFile[file] = (judged.uncoveredByFile[file] ?? 0) + 1;
            } else {
                judged.outsideVerdict[status] = (judged.outsideVerdict[status] ?? 0) + 1;
            }
        }
    }
    judged.survivors.sort(
        (a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.column - b.column,
    );
    return judged;
}

function countLines({ outsideVerdict, uncoveredByFile }: Judged): string[] {
    const uncovered = Object.entries(uncoveredByFile).toSorted(
        ([a, left], [b, right]) => right - left || a.localeCompare(b),
    );
    const total = uncovered.reduce((sum, [, count]) => sum + count, 0);
    const outside = Object.entries(outsideVerdict).toSorted(([a], [b]) => a.localeCompare(b));
    return [
        `${total} mutant(s) no module test runs — the specs', measured by range: typescript mutation --specs --mutate <file>:<from>-<to>`,
        ...uncovered.map(([file, count]) => `  ${file}  ${count}`),
        ...(outside.length === 0
            ? []
            : [
                  `${outside.reduce((sum, [, count]) => sum + count, 0)} mutant(s) outside the verdict — ${outside.map(([status, count]) => `${status} ${count}`).join(', ')}`,
              ]),
    ];
}

export function verdictOf(judged: Judged): { lines: string[]; status: number } {
    if (judged.survivors.length === 0) {
        return {
            lines: [
                `every mutant a module test runs is detected — ${judged.detected} detected`,
                ...countLines(judged),
            ],
            status: 0,
        };
    }
    return {
        lines: [
            ...judged.survivors.map(
                ({ column, file, line, mutator, replacement }) =>
                    `${file}:${line}:${column}  ${mutator} → ${replacement.split('\n')[0] ?? ''}`,
            ),
            refusal({
                fix: 'assert what the line decides — a value compared whole kills most of them — or, where no change of the line can alter what the module does, declare it above the line: // Stryker disable next-line <mutator>: <why the mutant is equivalent>',
                found: `${judged.survivors.length} mutant(s) a module test runs and none detects`,
                read: 'docs/07-quality-checks.md#mutation',
                why: 'a test that runs a line and lets a change of it pass proves nothing of that line',
            }),
            ...countLines(judged),
        ],
        status: 1,
    };
}
