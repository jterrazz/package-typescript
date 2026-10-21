import { isList, objectOf, stringOf } from '../../../lint/kit/project/json.js';
import { LOG_REASON, PINNED_TEXT_REASON } from '../../drivers/stryker/ignorers.js';
import { reportPathOf } from '../../drivers/stryker/reports.js';
import type { StageName } from '../../drivers/stryker/reports.js';
import { fileOfRange } from './scope.js';

export type Survivor = {
    column: number;
    file: string;
    line: number;
    mutator: string;
    /** The report file the survivor is read from: the module run's, or the suite's that answered for it. */
    report: string;
    replacement: string;
};

export type Judged = {
    detected: number;
    detectedByFile: Record<string, number>;
    detectedBySuite: number;
    /** The mutants set aside before any run, by what set them aside: a declaration, an ignorer, Stryker's static skip. */
    ignoredBy: Record<string, number>;
    left: number;
    outsideVerdict: Record<string, number>;
    survivors: Survivor[];
    uncoveredByFile: Record<string, number>;
    unrun: Record<string, number>;
};

const DETECTED: ReadonlySet<unknown> = new Set(['Killed', 'Timeout']);
const OUTSIDE_VERDICT: ReadonlySet<unknown> = new Set(['CompileError', 'Ignored', 'RuntimeError']);

const ABSENT = 'absent from the suite report';

const STATIC_SKIPPED = 'Static mutant (and "ignoreStatic" was enabled)';

const IGNORED_BY: ReadonlyMap<unknown, string> = new Map([
    [LOG_REASON, 'log calls'],
    [PINNED_TEXT_REASON, 'pinned text'],
    [STATIC_SKIPPED, 'static, no test loads it'],
]);

function survivorOf(file: string, mutant: Mutant, stage: StageName): Survivor {
    const start = objectOf(objectOf(mutant.location).start);
    return {
        column: Number(start.column),
        file,
        line: Number(start.line),
        mutator: stringOf(mutant.mutatorName) ?? '',
        report: reportPathOf(stage),
        replacement: stringOf(mutant.replacement) ?? '',
    };
}

function counted(counts: Record<string, number>, key: string): void {
    counts[key] = (counts[key] ?? 0) + 1;
}

function tally(judged: Judged, file: string, mutant: Mutant, stage: StageName): void {
    const status = stringOf(mutant.status) ?? 'no status';
    if (DETECTED.has(status)) {
        judged.detected += 1;
        counted(judged.detectedByFile, file);
    } else if (status === 'Survived') {
        judged.survivors.push(survivorOf(file, mutant, stage));
    } else if (status === 'NoCoverage') {
        counted(judged.uncoveredByFile, file);
    } else if (OUTSIDE_VERDICT.has(status)) {
        counted(judged.outsideVerdict, status);
        if (status === 'Ignored') {
            const by = IGNORED_BY.get(mutant.statusReason) ?? 'declared';
            counted(judged.ignoredBy, by);
        }
    } else {
        counted(judged.unrun, status);
    }
}

type Mutant = Record<string, unknown>;

function mutantsOf(report: unknown): [string, Mutant][] {
    return Object.entries(objectOf(objectOf(report).files)).flatMap(([file, entry]) => {
        const { mutants } = objectOf(entry);

        return isList(mutants) ? mutants.map((one): [string, Mutant] => [file, objectOf(one)]) : [];
    });
}

const LINES = /^(?<from>\d+)(?::\d+)?-(?<to>\d+)(?::\d+)?$/u;

// outside: Stryker holds a mutant in a `--mutate` range whole: a file named bare holds all of it, a range of lines what starts and ends within them; its report keeps an earlier run's results beyond the ranges, which this run did not measure.
function heldBy(ranges: readonly string[], file: string, mutant: Mutant): boolean {
    const { end, start } = objectOf(mutant.location);
    const first = Number(objectOf(start).line);
    const last = Number(objectOf(end).line);

    return ranges.some((range) => {
        if (range === file) {
            return true;
        }
        const lines = range.startsWith(`${file}:`)
            ? LINES.exec(range.slice(file.length + 1))?.groups
            : undefined;

        return lines !== undefined && first >= Number(lines.from) && last <= Number(lines.to);
    });
}

const heldMutantsOf = (report: unknown, ranges: readonly string[]): [string, Mutant][] =>
    mutantsOf(report).filter(([file, mutant]) => heldBy(ranges, file, mutant));

const keyOf = (file: string, mutant: Mutant): string => {
    const start = objectOf(objectOf(mutant.location).start);

    return JSON.stringify([file, start.line, start.column, mutant.mutatorName, mutant.replacement]);
};

/** What the module run hands the verdict: its report, the files and ranges it measured, and the mutants its tests ran beyond loading their files. */
export type ModuleRun = {
    measured: readonly string[];
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

/** The lines that reach a mutant of the run: the change, and for a static mutant `statics`, the tree's own change. `--mutate` names lines to measure, and never makes a table the module tests only load the suite's to judge. */
export type Reach = { changed: Changed; statics?: Changed };

const reachedBy = ({ changed, statics = changed }: Reach, file: string, mutant: Mutant): boolean =>
    reaches(mutant.static === true ? statics : changed, file, lineOf(mutant));

/** What the module tests hand the whole suite in `measured`, as the `--mutate` range of exactly each node, once: every mutant they let live, and what they could not measure on the lines the change reaches. */
export function handedToTheSuite(modules: ModuleRun, reach: Reach): string[] {
    const ranges = heldMutantsOf(modules.report, modules.measured)
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

type Answering = {
    answered: Map<string, Survivor>;
    forwarded: Set<string>;
    judged: Judged;
    measuredFiles: ReadonlySet<string>;
};

// invariant: a survivor the module tests handed on is detected where the suite detects it, and survives as the module tests reported it otherwise; a mutant they left counts where this run handed it on; a source with no module test counts what this run's ranges held.
function suiteAnswer(
    { answered, forwarded, judged, measuredFiles }: Answering,
    suite: { report: unknown; untested: readonly string[] },
): void {
    for (const [file, mutant] of mutantsOf(suite.report)) {
        const key = keyOf(file, mutant);
        const survivor = answered.get(key);
        if (survivor !== undefined) {
            answered.delete(key);
            if (DETECTED.has(mutant.status)) {
                judged.detected += 1;
                counted(judged.detectedByFile, file);
                judged.detectedBySuite += 1;
            } else {
                judged.survivors.push({ ...survivor, report: reportPathOf('suite') });
            }
        } else if (
            measuredFiles.has(file) ? forwarded.delete(key) : heldBy(suite.untested, file, mutant)
        ) {
            tally(judged, file, mutant, 'suite');
        }
    }
}

/** One verdict over both runs: a mutant the module tests let live is the suite's to answer, and survives only where the suite lets it live too; what they left is the suite's to judge where the change brought it there, and counted as left where it did not; a mutant handed to the suite that its report does not carry was judged by nothing; of each report, only what this run's ranges held counts, and an earlier run's results it carries beyond them count for nothing. */
export function judgedRuns(
    modules: ModuleRun,
    suite?: Reach & { report: unknown; untested: readonly string[] },
): Judged {
    const answering: Answering = {
        answered: new Map(),
        forwarded: new Set(),
        judged: {
            detected: 0,
            detectedByFile: {},
            detectedBySuite: 0,
            ignoredBy: {},
            left: 0,
            outsideVerdict: {},
            survivors: [],
            uncoveredByFile: {},
            unrun: {},
        },
        measuredFiles: new Set(modules.measured.map((range) => fileOfRange(range))),
    };
    const { answered, forwarded, judged } = answering;
    for (const [file, mutant] of heldMutantsOf(modules.report, modules.measured)) {
        if (suite !== undefined && survivedTheModules(mutant, modules.ranByTests)) {
            // Stryker disable next-line StringLiteral: the report of an answered survivor is replaced by the suite's when the suite judges it
            answered.set(keyOf(file, mutant), survivorOf(file, mutant, 'modules'));
        } else if (!leftByTheModules(mutant, modules.ranByTests)) {
            tally(judged, file, mutant, 'modules');
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
