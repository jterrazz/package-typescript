import { isList, objectOf } from '../../../../lint/kit/project/json.js';
import { mutantsOf } from '../../../../lint/kit/project/mutation-report.js';
import type { ReportMutant } from '../../../../lint/kit/project/mutation-report.js';
import type { Instrumented } from '../../../drivers/stryker/enumerate.js';
import { heldIn, isWidened } from '../../../drivers/stryker/mutate-entries.js';

/** A carried `CompileError` the checker answers again before the run trusts it: its id in the report, its file, and its span and replacement as a checker reads them, counted from 0. */
export type CarriedCompileError = {
    fileName: string;
    id: string;
    location: {
        end: { column: number; line: number };
        start: { column: number; line: number };
    };
    replacement: string;
};

/** What the record carries of a stage: how many mutants the run makes, and the sources holding one only Stryker can judge. */
export type Carried = { made: number; running: ReadonlySet<string> };

const RESULTS_A_NEW_TEST_MOVES: ReadonlySet<unknown> = new Set([
    'Ignored',
    'NoCoverage',
    'RuntimeError',
    'Survived',
    'Timeout',
]);

type Point = { column: number; line: number };

const pointOf = (value: unknown): Point => {
    const { column, line } = objectOf(value);

    return { column: Number(column), line: Number(line) };
};

const keyOf = (
    file: string,
    mutator: unknown,
    replacement: unknown,
    [start, end]: Point[],
): string => JSON.stringify([file, mutator, replacement, start, end]);

const reportKeyOf = (file: string, mutant: ReportMutant): string => {
    const { end, start } = objectOf(mutant.location);

    return keyOf(file, mutant.mutatorName, mutant.replacement, [pointOf(start), pointOf(end)]);
};

const madeKeyOf = (made: Instrumented): string =>
    keyOf(made.file, made.mutator, made.replacement, [
        { column: made.column, line: made.line },
        { column: made.endColumn, line: made.endLine },
    ]);

const killed = (mutant: ReportMutant): boolean =>
    mutant.status === 'Killed' && isList(mutant.killedBy) && mutant.killedBy.length > 0;

const zeroBased = (point: Point): Point => ({ column: point.column - 1, line: point.line - 1 });

function uncompiledOf(file: string, mutant: ReportMutant): CarriedCompileError {
    const { end, start } = objectOf(mutant.location);

    return {
        fileName: file,
        id: String(mutant.id),
        location: { end: zeroBased(pointOf(end)), start: zeroBased(pointOf(start)) },
        replacement: String(mutant.replacement),
    };
}

type Judged =
    | { kind: 'carried' }
    | { kind: 'running' }
    | { kind: 'uncompiled'; mutant: CarriedCompileError };

const CARRIED: Judged = { kind: 'carried' };

const RUNNING: Judged = { kind: 'running' };

// invariant: Stryker reuses a kill while its killer still covers the mutant, which a test no change made stale does; it runs again any other result a test it never saw covers now, and only a stale or new test can be one; it runs a compile error again wherever a test covers its line, since the report holds no test of it, so the checker answers it here as Stryker's own would.
function judgedFor(made: Instrumented, old: ReportMutant | undefined, fresh: boolean): Judged {
    if (old === undefined) {
        return RUNNING;
    }
    if (made.ignored || killed(old)) {
        return made.ignored === (old.status === 'Ignored') ? CARRIED : RUNNING;
    }
    if (old.status === 'CompileError') {
        return { kind: 'uncompiled', mutant: uncompiledOf(made.file, old) };
    }

    return RESULTS_A_NEW_TEST_MOVES.has(old.status) && !fresh ? CARRIED : RUNNING;
}

/**
 * What the record carries of a stage, read from the report the change left standing (`undefined` where it left none): each mutant the run makes within the stage's entries is carried when Stryker would reuse its result, a carried compile error while the compiler still refuses it, and its source runs otherwise.
 * `fresh` says whether the change made a test of the record stale or brought a test file the record does not know.
 */
export async function carriedOf({
    fresh,
    instrumented,
    mutate,
    refusedAmong,
    report,
    textOf,
}: {
    fresh: boolean;
    instrumented: () => Promise<readonly Instrumented[]>;
    mutate: readonly string[];
    refusedAmong: (
        mutants: readonly CarriedCompileError[],
    ) => Promise<ReadonlySet<string> | undefined>;
    report: Record<string, unknown> | undefined;
    textOf: (file: string) => string | undefined;
}): Promise<Carried | undefined> {
    if (report === undefined) {
        return undefined;
    }
    const all = await instrumented();
    const made = all.filter((mutant) =>
        heldIn(mutate, mutant.file, {
            end: { column: mutant.endColumn, line: mutant.endLine },
            start: { column: mutant.column, line: mutant.line },
        }),
    );
    const old = new Map(
        mutantsOf(report).map(([file, mutant]) => [reportKeyOf(file, mutant), mutant]),
    );
    const sources = objectOf(report.files);
    const running = new Set<string>();
    const uncompiled: CarriedCompileError[] = [];
    for (const one of made) {
        const held = objectOf(sources[one.file]).source;
        const judged =
            isWidened(one.file) || held !== textOf(one.file)
                ? RUNNING
                : judgedFor(one, old.get(madeKeyOf(one)), fresh);
        if (judged.kind === 'running') {
            running.add(one.file);
        } else if (judged.kind === 'uncompiled') {
            uncompiled.push(judged.mutant);
        }
    }
    const refused = uncompiled.length === 0 ? new Set() : await refusedAmong(uncompiled);
    for (const { fileName, id } of uncompiled) {
        if (refused?.has(id) !== true) {
            running.add(fileName);
        }
    }

    return { made: made.length, running };
}
