import { refusal } from '../../lint/kit/catalogue/lesson.js';
import { isList, objectOf, stringOf } from '../../lint/kit/project/json.js';

export type Survivor = {
    column: number;
    file: string;
    line: number;
    mutator: string;
    replacement: string;
};

export type Judged = { detected: number; survivors: Survivor[]; uncovered: number };

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

/** Stryker's report, read as the gate reads it: a mutant a module test runs is detected or survives; one no module test runs is the specs' to measure. An incremental report keeps the files of earlier runs, so only the files measured are judged. */
export function judgedReport(report: unknown, measured: ReadonlySet<string>): Judged {
    const judged: Judged = { detected: 0, survivors: [], uncovered: 0 };
    for (const [file, entry] of Object.entries(objectOf(objectOf(report).files))) {
        if (!measured.has(file)) {
            continue;
        }
        const { mutants } = objectOf(entry);
        for (const mutant of isList(mutants) ? mutants.map((one) => objectOf(one)) : []) {
            if (DETECTED.has(mutant.status)) {
                judged.detected += 1;
            } else if (mutant.status === 'Survived') {
                judged.survivors.push(survivorOf(file, mutant));
            } else if (mutant.status === 'NoCoverage') {
                judged.uncovered += 1;
            }
        }
    }
    judged.survivors.sort(
        (a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.column - b.column,
    );
    return judged;
}

export function verdictOf(judged: Judged): { lines: string[]; status: number } {
    const uncovered = `${judged.uncovered} mutant(s) no module test runs — the specs', measured by range: typescript mutation --specs --mutate <file>:<from>-<to>`;
    if (judged.survivors.length === 0) {
        return {
            lines: [
                `every mutant a module test runs is detected — ${judged.detected} detected`,
                uncovered,
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
            uncovered,
        ],
        status: 1,
    };
}
