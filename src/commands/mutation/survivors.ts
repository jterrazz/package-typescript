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
    detectedBySuite: number;
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

// invariant: the module tests leave a mutant to the suite when none of them runs it, or only loading a module runs it and the tests loading it let it live or could not be credited with it; one a test also ran is theirs to answer.
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

// invariant: a mutant a module test runs and none detects is the whole suite's to answer, wherever it stands: a spec may prove the line the module test only runs, and the verdict fails only on what the suite also lets live.
const survivedTheModules = (mutant: Mutant, ranByTests: ReadonlySet<string>): boolean =>
    mutant.status === 'Survived' && !leftByTheModules(mutant, ranByTests);

/** The lines that reach a mutant of the run: the change, and for a static mutant `statics`, the tree's own change — `--mutate` names lines to measure, and never makes a table the module tests only load the suite's to judge. */
export type Reach = { changed: Changed; statics?: Changed };

const reachedBy = ({ changed, statics = changed }: Reach, file: string, mutant: Mutant): boolean =>
    reaches(mutant.static === true ? statics : changed, file, lineOf(mutant));

/** What the module tests hand the whole suite in `measured`, as the `--mutate` range of exactly each node, once: every mutant they let live, and what they could not measure on the lines the change reaches. */
export function handedToTheSuite(modules: ModuleRun, reach: Reach): string[] {
    const ranges = mutantsOf(modules.report, modules.measured)
        .filter(
            ([file, mutant]) =>
                survivedTheModules(mutant, modules.ranByTests) ||
                (leftByTheModules(mutant, modules.ranByTests) && reachedBy(reach, file, mutant)),
        )
        .map(([file, mutant]) => {
            const { end, start } = objectOf(mutant.location);
            const from = objectOf(start);
            const to = objectOf(end);

            return `${file}:${Number(from.line)}:${Number(from.column) - 1}-${Number(to.line)}:${Number(to.column) - 1}`;
        });

    return [...new Set(ranges)];
}

// outside: Stryker holds a mutant in a `--mutate` range whole: a file named bare holds all of it, a range of lines what starts and ends within them.
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

type Answering = {
    answered: Map<string, Survivor>;
    forwarded: Set<string>;
    judged: Judged;
    modules: ModuleRun;
};

// invariant: a survivor the module tests handed on is detected where the suite detects it, and survives as the module tests reported it otherwise; a mutant they left counts where this run handed it on; a source with no module test counts what this run's ranges held.
function suiteAnswer(
    { answered, forwarded, judged, modules }: Answering,
    suite: { report: unknown; untested: readonly string[] },
): void {
    for (const [file, mutant] of mutantsOf(suite.report)) {
        const key = keyOf(file, mutant);
        const survivor = answered.get(key);
        if (survivor !== undefined) {
            answered.delete(key);
            if (DETECTED.has(mutant.status)) {
                judged.detected += 1;
                judged.detectedBySuite += 1;
            } else {
                judged.survivors.push(survivor);
            }
        } else if (
            modules.measured.has(file)
                ? forwarded.delete(key)
                : heldBy(suite.untested, file, mutant)
        ) {
            tally(judged, file, mutant);
        }
    }
}

/** One verdict over both runs: a mutant the module tests let live is the suite's to answer, and survives only where the suite lets it live too; what they left is the suite's to judge where the change brought it there, and counted as left where it did not; a mutant handed to the suite that its report does not carry was judged by nothing; of a source with no module test, the suite's report counts only what this run's ranges held — an earlier run's results it carries beyond them count for nothing. */
export function judgedRuns(
    modules: ModuleRun,
    suite?: Reach & { report: unknown; untested: readonly string[] },
): Judged {
    const answering: Answering = {
        answered: new Map(),
        forwarded: new Set(),
        judged: {
            detected: 0,
            detectedBySuite: 0,
            left: 0,
            outsideVerdict: {},
            survivors: [],
            uncoveredByFile: {},
            unrun: {},
        },
        modules,
    };
    const { answered, forwarded, judged } = answering;
    for (const [file, mutant] of mutantsOf(modules.report, modules.measured)) {
        if (suite !== undefined && survivedTheModules(mutant, modules.ranByTests)) {
            answered.set(keyOf(file, mutant), survivorOf(file, mutant));
        } else if (!leftByTheModules(mutant, modules.ranByTests)) {
            tally(judged, file, mutant);
        } else if (suite !== undefined && reachedBy(suite, file, mutant)) {
            forwarded.add(keyOf(file, mutant));
        } else {
            judged.left += 1;
        }
    }
    if (suite !== undefined) {
        suiteAnswer(answering, suite);
    }
    if (forwarded.size + answered.size > 0) {
        judged.unrun[ABSENT] = forwarded.size + answered.size;
    }
    judged.survivors.sort(
        (a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.column - b.column,
    );
    return judged;
}
