import { refusal } from '../../../lint/kit/catalogue/lesson.js';
import { isBrowserSide } from '../../../lint/kit/project/browser-side.js';
import type { Base } from './change.js';
import { byRole } from './roles.js';
import type { GlueBar, GlueHeld } from './roles.js';
import type { Judged, Survivor } from './survivors.js';

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

function outsideOf({ ignoredBy, outsideVerdict }: Judged): { statuses: string; total: number } {
    const { total } = countsOf(outsideVerdict);
    const statuses = Object.entries(outsideVerdict)
        .toSorted(([a], [b]) => a.localeCompare(b))
        .map(([status, count]) =>
            status === 'Ignored'
                ? `${status} ${count} (${countsOf(ignoredBy).statuses})`
                : `${status} ${count}`,
        )
        .join(', ');

    return { statuses, total };
}

function countLines(judged: Judged, untestedSources: number): string[] {
    const { detectedBySuite, left: leftCount, uncoveredByFile } = judged;
    const sorted = Object.entries(uncoveredByFile).toSorted(byMostFirst);
    const browser = sorted.filter(([file]) => isBrowserSide(file));
    const uncovered = sorted.filter(([file]) => !isBrowserSide(file));
    const outside = outsideOf(judged);
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
                  `unmeasured: ${totalOf(browser)} mutant(s) of browser-side sources: the mutation run starts no browser project, so no count claims them detected`,
                  ...withFiles(browser),
              ]),
        ...(leftCount === 0
            ? []
            : [
                  `${leftCount} mutant(s) the module tests leave to the suite (none of them runs it, or only loading a module does) on lines no change has brought there; the whole suite measures them when one does`,
              ]),
        ...(untestedSources === 0
            ? []
            : [
                  `${untestedSources} source(s) with no module test: the whole suite measures the lines a change reaches there; what no change reaches no count holds`,
              ]),
        ...(outside.total === 0
            ? []
            : [`${outside.total} mutant(s) outside the verdict: ${outside.statuses}`]),
    ];
}

const placed = ({ column, file, line, mutator, replacement, report }: Survivor): string =>
    `${file}:${line}:${column}  ${mutator}: ${String(replacement.split('\n', 1))}  (${report})`;

function survivorLines(survivors: readonly Survivor[]): string[] {
    if (survivors.length === 0) {
        return [];
    }
    return [
        ...survivors.map((survivor) => placed(survivor)),
        refusal({
            fix: 'assert what the line decides (a value compared whole kills most of them) or, where no change of the line can alter what the module does, declare it above the line: // Stryker disable next-line <mutator>: <why the mutant is equivalent>',
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
            fix: 'run `typescript mutation` again to its end: a run stopped midway leaves its mutants Pending, and the next one runs them',
            found: `${total} mutant(s) the run never judged: ${statuses}`,
            read: 'docs/reference/quality-checks.md#mutation',
            why: 'a mutant no test was run against says nothing of the line it mutates, so passing it would pass a run that judged nothing there',
        }),
    ];
}

const percentOf = (part: number, whole: number): number => Math.floor((part * 100) / whole);

const glueLine = ({ bar, detected, judged }: GlueHeld): string =>
    `glue: ${detected} of ${judged} detected (${percentOf(detected, judged)} %), its bar ${Math.round(bar * 100)} %`;

// invariant: glue below its bar fails the run, and every glue survivor is printed either way, at its place, under the glue line.
function glueLines(glue: GlueHeld): { lines: string[]; refused: string[] } {
    if (glue.judged === 0) {
        return { lines: [], refused: [] };
    }
    const lines = [
        glueLine(glue),
        ...(glue.capped === undefined
            ? []
            : [`glue: ${glue.capped.measured} of ${glue.capped.of} mutants measured, the cap`]),
        ...glue.survivors.map((survivor) => `  ${placed(survivor)}`),
    ];
    if (glue.holds) {
        return { lines, refused: [] };
    }

    return {
        lines: [],
        refused: [
            ...lines,
            refusal({
                fix: 'assert what the surviving glue lines decide, or declare one no change of the line can tell apart above it: // Stryker disable next-line <mutator>: <why the mutant is equivalent>',
                found: `glue: ${glue.detected} of ${glue.judged} mutant(s) a test runs detected, under its bar of ${Math.round(glue.bar * 100)} %`,
                read: 'docs/reference/quality-checks.md#domain-and-glue',
                why: 'glue (an adapter, the composition root, a presentation) is held to a share of the mutants its tests run, and this change leaves more of them alive than the share allows',
            }),
        ],
    };
}

/** What a verdict names of its measure: the range of commits it covers. */
export type Measure = { range: string; unmeasured?: string | undefined };

/** What a verdict names of the base it was measured from. */
export const measureOf = ({ range, unmeasured }: Pick<Base, 'range' | 'unmeasured'>): Measure => ({
    range,
    unmeasured,
});

// invariant: a verdict whose scope is narrower than `merge-base..HEAD` of the branch says which commits it did not measure, so a green over a dirty tree is never read as a green over the branch.
const unmeasuredLines = ({ unmeasured }: Measure): string[] =>
    unmeasured === undefined
        ? []
        : [
              `warning: this verdict is narrower than the branch: ${unmeasured} is not measured; commit the work and run again, or name the base with --since to measure the branch`,
          ];

// invariant: a run that mutated nothing never reads as a run whose mutants were all detected; it says what it measured, or that it measured nothing and why.
function passedLine({ detected }: Judged, { range }: Measure, glue: GlueHeld): string {
    if (detected === 0) {
        return `measured nothing over ${range}: no changed TypeScript source ran a mutant, or the project has none to mutate`;
    }

    return glue.survivors.length === 0
        ? `measured ${detected} mutants over ${range}: every mutant a test runs is detected`
        : `measured ${detected} mutants over ${range}: every domain mutant a test runs is detected, and glue holds its bar`;
}

/** The verdict's lines and status: a domain survivor fails it, glue only under its bar; the sources with no module test, which no run mutates until a change reaches them, counted apart. */
export function verdictOf(
    judged: Judged,
    untestedSources: number,
    { glue: bar, measure }: { glue: GlueBar; measure: Measure },
): { lines: string[]; status: number } {
    const { domain, glue } = byRole(judged, bar);
    const held = glueLines(glue);
    const refused = [...survivorLines(domain), ...held.refused, ...unrunLines(judged)];
    if (refused.length === 0) {
        return {
            lines: [
                passedLine(judged, measure, glue),
                ...unmeasuredLines(measure),
                ...held.lines,
                ...countLines(judged, untestedSources),
            ],
            status: 0,
        };
    }
    return {
        lines: [
            ...refused,
            ...unmeasuredLines(measure),
            ...held.lines,
            ...countLines(judged, untestedSources),
        ],
        status: 1,
    };
}
