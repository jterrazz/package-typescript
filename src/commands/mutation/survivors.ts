import { refusal } from '../../../lint/kit/catalogue/lesson.js';
import { isList, objectOf, stringOf } from '../../../lint/kit/project/json.js';

export type Survivor = {
    column: number;
    file: string;
    line: number;
    mutator: string;
    replacement: string;
};

export type Judged = {
    detected: number;
    left: number;
    outsideVerdict: Record<string, number>;
    survivors: Survivor[];
    uncoveredByFile: Record<string, number>;
    unrun: Record<string, number>;
};

const DETECTED: ReadonlySet<unknown> = new Set(['Killed', 'Timeout']);
const OUTSIDE_VERDICT: ReadonlySet<unknown> = new Set(['CompileError', 'Ignored', 'RuntimeError']);

const ABSENT = 'absent from the suite report';

function survivorOf(file: string, mutant: Mutant): Survivor {
    const start = objectOf(objectOf(mutant.location).start);
    return {
        column: Number(start.column),
        file,
        line: Number(start.line),
        mutator: stringOf(mutant.mutatorName) ?? '',
        replacement: stringOf(mutant.replacement) ?? '',
    };
}

function tally(judged: Judged, file: string, mutant: Mutant): void {
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

type Mutant = Record<string, unknown>;

function mutantsOf(report: unknown, measured?: ReadonlySet<string>): [string, Mutant][] {
    return Object.entries(objectOf(objectOf(report).files)).flatMap(([file, entry]) => {
        if (measured !== undefined && !measured.has(file)) {
            return [];
        }
        const { mutants } = objectOf(entry);

        return isList(mutants) ? mutants.map((one): [string, Mutant] => [file, objectOf(one)]) : [];
    });
}

const keyOf = (file: string, mutant: Mutant): string => {
    const start = objectOf(objectOf(mutant.location).start);

    return JSON.stringify([file, start.line, start.column, mutant.mutatorName, mutant.replacement]);
};

/** What the module run hands the verdict: its report, the files it measured, and the mutants its tests ran beyond loading their files. */
export type ModuleRun = {
    measured: ReadonlySet<string>;
    ranByTests: ReadonlySet<string>;
    report: unknown;
};

/** A mutant the module tests leave to the suite: none of them runs it, or only loading a module runs it and the tests loading it let it live or could not be credited with it; one a test also ran is theirs to answer. */
function leftByTheModules(mutant: Mutant, ranByTests: ReadonlySet<string>): boolean {
    // Stryker disable next-line StringLiteral: a mutant without an id is in no set of ids, whatever stands in for it
    const ranByATest = ranByTests.has(stringOf(mutant.id) ?? '');

    return (
        mutant.status === 'NoCoverage' ||
        (mutant.static === true &&
            (mutant.status === 'Ignored' || (mutant.status === 'Survived' && !ranByATest)))
    );
}

/** Lines a change touched, file by file: `true` for a file the change adds whole. */
export type Changed = ReadonlyMap<string, readonly (readonly [number, number])[] | true>;

const lineOf = (mutant: Mutant): number => Number(objectOf(objectOf(mutant.location).start).line);

/** Whether the change reaches a mutant: a file it adds, or a line of the hunks it rewrote. */
export function reaches(changed: Changed, file: string, line: number): boolean {
    const lines = changed.get(file);

    return lines === true || (lines?.some(([from, to]) => line >= from && line <= to) ?? false);
}

/** The mutants the module tests left in `measured` on lines the change reaches, as the `--mutate` range of exactly each node, once, for the whole suite to measure. */
export function leftToTheSuite(modules: ModuleRun, changed: Changed): string[] {
    const ranges = mutantsOf(modules.report, modules.measured)
        .filter(
            ([file, mutant]) =>
                leftByTheModules(mutant, modules.ranByTests) &&
                reaches(changed, file, lineOf(mutant)),
        )
        .map(([file, mutant]) => {
            const { end, start } = objectOf(mutant.location);
            const from = objectOf(start);
            const to = objectOf(end);

            return `${file}:${Number(from.line)}:${Number(from.column) - 1}-${Number(to.line)}:${Number(to.column) - 1}`;
        });

    return [...new Set(ranges)];
}

/** Whether this run's `--mutate` ranges hold a mutant whole, as Stryker reads them: a file named bare holds all of it, a range of lines what starts and ends within them. */
function heldBy(ranges: readonly string[], file: string, mutant: Mutant): boolean {
    const { end, start } = objectOf(mutant.location);
    const first = Number(objectOf(start).line);
    const last = Number(objectOf(end).line);

    return ranges.some((range) => {
        if (range === file) {
            return true;
        }
        const [from, to] = range
            .slice(file.length + 1)
            .split('-')
            .map(Number);

        return (
            range.startsWith(`${file}:`) &&
            first >= (from ?? Number.NaN) &&
            last <= (to ?? Number.NaN)
        );
    });
}

/** One verdict over both runs: what the module tests left is the suite's to judge where the change brought it there, and counted as left where it did not; a mutant the change brought that the suite's report does not carry was judged by nothing; of a source no module test sits beside, the suite's report counts only what this run's ranges held — an earlier run's results it carries beyond them count for nothing. */
export function judgedRuns(
    modules: ModuleRun,
    suite?: { changed: Changed; report: unknown; untested: readonly string[] },
): Judged {
    const judged: Judged = {
        detected: 0,
        left: 0,
        outsideVerdict: {},
        survivors: [],
        uncoveredByFile: {},
        unrun: {},
    };
    const forwarded = new Set<string>();
    for (const [file, mutant] of mutantsOf(modules.report, modules.measured)) {
        if (!leftByTheModules(mutant, modules.ranByTests)) {
            tally(judged, file, mutant);
        } else if (suite !== undefined && reaches(suite.changed, file, lineOf(mutant))) {
            forwarded.add(keyOf(file, mutant));
        } else {
            judged.left += 1;
        }
    }
    if (suite !== undefined) {
        for (const [file, mutant] of mutantsOf(suite.report)) {
            const measuredNow = modules.measured.has(file)
                ? forwarded.delete(keyOf(file, mutant))
                : heldBy(suite.untested, file, mutant);
            if (measuredNow) {
                tally(judged, file, mutant);
            }
        }
    }
    if (forwarded.size > 0) {
        judged.unrun[ABSENT] = forwarded.size;
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

function countLines(
    { left: leftCount, outsideVerdict, uncoveredByFile }: Judged,
    untestedSources: number,
): string[] {
    const uncovered = Object.entries(uncoveredByFile).toSorted(
        ([a, left], [b, right]) => right - left || a.localeCompare(b),
    );
    const total = uncovered.reduce((sum, [, count]) => sum + count, 0);
    const outside = countsOf(outsideVerdict);
    return [
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
                  `${untestedSources} source(s) no module test sits beside — the whole suite measures the lines a change reaches there; what no change reaches no count holds`,
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

/** The verdict's lines and status, counting apart the sources no module test sits beside, which no run mutates until a change reaches them. */
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
