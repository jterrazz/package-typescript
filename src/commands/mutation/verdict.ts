import { refusal } from '../../../lint/kit/catalogue/lesson.js';
import type { Judged } from './survivors.js';

function countsOf(byStatus: Record<string, number>): { statuses: string; total: number } {
    const sorted = Object.entries(byStatus).toSorted(([a], [b]) => a.localeCompare(b));
    return {
        statuses: sorted.map(([status, count]) => `${status} ${count}`).join(', '),
        total: sorted.reduce((sum, [, count]) => sum + count, 0),
    };
}

function countLines(
    { detectedBySuite, left: leftCount, outsideVerdict, uncoveredByFile }: Judged,
    untestedSources: number,
): string[] {
    const uncovered = Object.entries(uncoveredByFile).toSorted(
        ([a, left], [b, right]) => right - left || a.localeCompare(b),
    );
    const total = uncovered.reduce((sum, [, count]) => sum + count, 0);
    const outside = countsOf(outsideVerdict);
    return [
        ...(detectedBySuite === 0
            ? []
            : [
                  `${detectedBySuite} mutant(s) the module tests let live, detected by the whole suite`,
              ]),
        `${total} mutant(s) no test runs`,
        ...uncovered.map(([file, count]) => `  ${file}  ${count}`),
        ...(leftCount === 0
            ? []
            : [
                  `${leftCount} mutant(s) the module tests leave to the suite — none of them runs it, or only loading a module does — on lines no change has brought there; the whole suite measures them when one does`,
              ]),
        ...(untestedSources === 0
            ? []
            : [
                  `${untestedSources} source(s) with no module test — the whole suite measures the lines a change reaches there; what no change reaches no count holds`,
              ]),
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
                `${file}:${line}:${column}  ${mutator} → ${String(replacement.split('\n', 1))}`,
        ),
        refusal({
            fix: 'assert what the line decides — a value compared whole kills most of them — or, where no change of the line can alter what the module does, declare it above the line: // Stryker disable next-line <mutator>: <why the mutant is equivalent>',
            found: `${survivors.length} mutant(s) a test runs and none detects`,
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

/** The verdict's lines and status, counting apart the sources with no module test, which no run mutates until a change reaches them. */
export function verdictOf(
    judged: Judged,
    untestedSources: number,
): { lines: string[]; status: number } {
    const refused = [...survivorLines(judged), ...unrunLines(judged)];
    if (refused.length === 0) {
        return {
            lines: [
                `every mutant a test runs is detected — ${judged.detected} detected`,
                ...countLines(judged, untestedSources),
            ],
            status: 0,
        };
    }
    return { lines: [...refused, ...countLines(judged, untestedSources)], status: 1 };
}
