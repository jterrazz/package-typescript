import { refusal } from '../../../lint/kit/catalogue/lesson.js';
import { isBrowserSide } from '../../../lint/kit/project/browser-side.js';
import type { Judged } from './survivors.js';

function countsOf(byStatus: Record<string, number>): { statuses: string; total: number } {
    const sorted = Object.entries(byStatus).toSorted(([a], [b]) => a.localeCompare(b));
    return {
        statuses: sorted.map(([status, count]) => `${status} ${count}`).join(', '),
        total: sorted.reduce((sum, [, count]) => sum + count, 0),
    };
}

const byMostFirst = ([a, left]: [string, number], [b, right]: [string, number]): number =>
    right - left || a.localeCompare(b);

const withFiles = (entries: readonly [string, number][]): string[] =>
    entries.map(([file, count]) => `  ${file}  ${count}`);

const totalOf = (entries: readonly [string, number][]): number =>
    entries.reduce((sum, [, count]) => sum + count, 0);

function countLines(
    { detectedBySuite, left: leftCount, outsideVerdict, uncoveredByFile }: Judged,
    untestedSources: number,
): string[] {
    const sorted = Object.entries(uncoveredByFile).toSorted(byMostFirst);
    const browser = sorted.filter(([file]) => isBrowserSide(file));
    const uncovered = sorted.filter(([file]) => !isBrowserSide(file));
    const outside = countsOf(outsideVerdict);
    return [
        ...(detectedBySuite === 0
            ? []
            : [
                  `${detectedBySuite} mutant(s) the module tests let live, detected by the whole suite`,
              ]),
        `${totalOf(uncovered)} mutant(s) no test runs`,
        ...withFiles(uncovered),
        ...(browser.length === 0
            ? []
            : [
                  `unmeasured: ${totalOf(browser)} mutant(s) of browser-side sources — the mutation run starts no browser project, so no count claims them detected`,
                  ...withFiles(browser),
              ]),
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
            ({ column, file, line, mutator, replacement, report }) =>
                `${file}:${line}:${column}  ${mutator} → ${String(replacement.split('\n', 1))}  (${report})`,
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

/** What a verdict names of its measure: the range of commits it covers. */
export type Measure = { range: string; unmeasured?: string | undefined };

// invariant: a verdict whose scope is narrower than `merge-base..HEAD` of the branch says which commits it did not measure, so a green over a dirty tree is never read as a green over the branch.
const unmeasuredLines = ({ unmeasured }: Measure): string[] =>
    unmeasured === undefined
        ? []
        : [
              `warning: this verdict is narrower than the branch — ${unmeasured} is not measured; commit the work and run again, or name the base with --since to measure the branch`,
          ];

// invariant: a run that mutated nothing never reads as a run whose mutants were all detected; it says what it measured, or that it measured nothing and why.
function passedLine({ detected }: Judged, { range }: Measure): string {
    return detected === 0
        ? `measured nothing over ${range}: no changed TypeScript source ran a mutant, or the project has none to mutate`
        : `measured ${detected} mutants over ${range} — every mutant a test runs is detected`;
}

/** The verdict's lines and status, counting apart the sources with no module test, which no run mutates until a change reaches them. */
export function verdictOf(
    judged: Judged,
    untestedSources: number,
    measure: Measure,
): { lines: string[]; status: number } {
    const refused = [...survivorLines(judged), ...unrunLines(judged)];
    if (refused.length === 0) {
        return {
            lines: [
                passedLine(judged, measure),
                ...unmeasuredLines(measure),
                ...countLines(judged, untestedSources),
            ],
            status: 0,
        };
    }
    return {
        lines: [...refused, ...unmeasuredLines(measure), ...countLines(judged, untestedSources)],
        status: 1,
    };
}
