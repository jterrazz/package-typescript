import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { isList, objectOf, stringOf } from '../../../lint/kit/project/json.js';
import { uncompiledFound } from '../../drivers/tsc/compile-error.js';
import {
    headOf,
    mutationSummaryOf,
    VERDICT_FILE,
    verdictLineOf,
    verdictWritten,
} from '../check/report/gate-verdict.js';
import type {
    MutationVerdict,
    PassVerdict,
    VerdictSurvivor,
} from '../check/report/gate-verdict.js';
import { print } from '../terminal.js';
import { byRole } from './roles.js';
import type { GlueBar } from './roles.js';
import type { Judged, Survivor } from './survivors.js';
import type { Measure } from './verdict.js';

/** What a mutation run hands its verdict file as it goes: each stage, the numbers it judged, or why it judged none. */
export type Recorded = {
    mutation: MutationVerdict | undefined;
    passes: PassVerdict[];
    reason: string;
};

export const recorder = (): Recorded => ({ mutation: undefined, passes: [], reason: '' });

const STAGE_LABELS = {
    modules: 'Mutation (module tests)',
    suite: 'Mutation (whole suite)',
} as const;

/** Adds a stage's run as a pass; a stage Stryker stopped is why the run judged nothing. */
export function stageRecorded(
    recorded: Recorded,
    stage: keyof typeof STAGE_LABELS,
    {
        seconds,
        status,
        uncompiled,
    }: { seconds: number; status: number; uncompiled?: string | undefined },
): void {
    const stopped =
        uncompiled === undefined
            ? `Stryker exited ${String(status)}; its log is above`
            : uncompiledFound(uncompiled);
    recorded.passes.push({
        firstError: status === 0 ? null : stopped,
        label: STAGE_LABELS[stage],
        seconds,
        status,
    });
    if (status !== 0) {
        recorded.reason =
            uncompiled === undefined
                ? `Stryker stopped the ${stage === 'suite' ? 'whole suite' : 'module tests'} with status ${String(status)}; its log is above`
                : uncompiledFound(uncompiled);
    }
}

const asDomain = (survivor: Survivor): VerdictSurvivor => ({ ...survivor, role: 'domain' });

const asGlue = (survivor: Survivor): VerdictSurvivor => ({ ...survivor, role: 'glue' });

export function judgedRecorded(
    recorded: Recorded,
    judged: Judged,
    { glue: bar, measure }: { glue: GlueBar; measure: Measure },
): void {
    const { domain, glue } = byRole(judged, bar);
    recorded.mutation = {
        detected: judged.detected,
        glue: {
            bar: glue.bar,
            detected: glue.detected,
            judged: glue.judged,
            survivors: glue.survivors.map(asGlue),
        },
        range: measure.range,
        survivors: [...domain.map(asDomain), ...(glue.holds ? [] : glue.survivors.map(asGlue))],
        unrun: Object.values(judged.unrun).reduce((sum, count) => sum + count, 0),
    };
}

const countOf = (value: unknown): number => (typeof value === 'number' ? value : 0);

function parsedVerdictOf(file: string): unknown {
    // Stryker disable BlockStatement: a catch left empty returns undefined as this one does, and a try emptied returns it for every file, which the tests reading a member's numbers see
    try {
        return JSON.parse(String(readFileSync(file)));
    } catch {
        return undefined;
    }
    // Stryker restore BlockStatement
}

const survivorsOf = (member: string, survivors: unknown): VerdictSurvivor[] =>
    (isList(survivors) ? survivors : []).map((one) => {
        const { column, file, line, mutator, replacement, report, role } = objectOf(one);

        return {
            column: countOf(column),
            file: `${member}/${stringOf(file) ?? ''}`,
            line: countOf(line),
            mutator: stringOf(mutator) ?? '',
            replacement: stringOf(replacement) ?? '',
            report: `${member}/${stringOf(report) ?? ''}`,
            role: role === 'glue' ? 'glue' : 'domain',
        };
    });

function memberVerdictOf(project: string, member: string): MutationVerdict | undefined {
    const { mutation } = objectOf(parsedVerdictOf(join(project, member, VERDICT_FILE)));
    if (mutation === null || mutation === undefined) {
        return undefined;
    }
    const { detected, glue, range, survivors, unrun } = objectOf(mutation);
    const held = objectOf(glue);

    return {
        detected: countOf(detected),
        glue: {
            bar: countOf(held.bar),
            detected: countOf(held.detected),
            judged: countOf(held.judged),
            survivors: survivorsOf(member, held.survivors),
        },
        range: stringOf(range) ?? '',
        survivors: survivorsOf(member, survivors),
        unrun: countOf(unrun),
    };
}

/** Adds a member's run to the root's: its status and seconds as one pass, its numbers to the root's. */
export function memberRecorded(
    recorded: Recorded,
    project: string,
    { member, seconds, status }: { member: string; seconds: number; status: number },
): void {
    const own = memberVerdictOf(project, member);
    recorded.passes.push({
        firstError: status === 0 ? null : `${member} failed; its verdict is above`,
        label: member,
        seconds,
        status,
    });
    if (own === undefined) {
        return;
    }
    const sum = recorded.mutation ?? {
        detected: 0,
        glue: { bar: own.glue.bar, detected: 0, judged: 0, survivors: [] },
        range: own.range,
        survivors: [],
        unrun: 0,
    };
    recorded.mutation = {
        detected: sum.detected + own.detected,
        glue: {
            bar: own.glue.bar,
            detected: sum.glue.detected + own.glue.detected,
            judged: sum.glue.judged + own.glue.judged,
            survivors: [...sum.glue.survivors, ...own.glue.survivors],
        },
        range: sum.range === own.range ? sum.range : `${sum.range}, ${own.range}`,
        survivors: [...sum.survivors, ...own.survivors],
        unrun: sum.unrun + own.unrun,
    };
}

/** Writes the run's verdict file and prints its last line. */
export function concluded(project: string, recorded: Recorded, status: number): number {
    verdictWritten(project, {
        command: 'mutation',
        head: headOf(project),
        mutation: recorded.mutation ?? null,
        passes: recorded.passes,
        status,
    });
    print(
        `\n${verdictLineOf(status, mutationSummaryOf(status, recorded.mutation ?? recorded.reason))}`,
    );

    return status;
}
