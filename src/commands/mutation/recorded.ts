import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { isList, objectOf, stringOf } from '../../../lint/kit/project/json.js';
import {
    headOf,
    mutationSummaryOf,
    VERDICT_FILE,
    verdictLineOf,
    verdictWritten,
} from '../check/report/gate-verdict.js';
import type { MutationVerdict, PassVerdict } from '../check/report/gate-verdict.js';
import { print } from '../check/report/terminal.js';
import type { Judged } from './survivors.js';
import type { Measure } from './verdict.js';

/** What a mutation run hands its verdict file as it goes: each stage, the numbers it judged, or why it judged none. */
export type Recorded = {
    mutation: MutationVerdict | undefined;
    passes: PassVerdict[];
    reason: string;
};

export const recorder = (): Recorded => ({ mutation: undefined, passes: [], reason: '' });

export const STAGE_LABELS = {
    modules: 'Mutation (module tests)',
    suite: 'Mutation (whole suite)',
} as const;

/** Adds a stage's run as a pass; a stage Stryker stopped is why the run judged nothing. */
export function stageRecorded(
    recorded: Recorded,
    stage: keyof typeof STAGE_LABELS,
    { seconds, status }: { seconds: number; status: number },
): void {
    recorded.passes.push({
        firstError: status === 0 ? null : `Stryker exited ${String(status)}; its log is above`,
        label: STAGE_LABELS[stage],
        seconds,
        status,
    });
    if (status !== 0) {
        recorded.reason = `Stryker stopped the ${stage === 'suite' ? 'whole suite' : 'module tests'} with status ${String(status)}; its log is above`;
    }
}

export function judgedRecorded(recorded: Recorded, judged: Judged, { range }: Measure): void {
    recorded.mutation = {
        detected: judged.detected,
        range,
        survivors: judged.survivors.map(({ file, line, mutator }) => ({ file, line, mutator })),
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

function memberVerdictOf(project: string, member: string): MutationVerdict | undefined {
    const { mutation } = objectOf(parsedVerdictOf(join(project, member, VERDICT_FILE)));
    if (mutation === null || mutation === undefined) {
        return undefined;
    }
    const { detected, range, survivors, unrun } = objectOf(mutation);

    return {
        detected: countOf(detected),
        range: stringOf(range) ?? '',
        survivors: (isList(survivors) ? survivors : []).map((one) => {
            const { file, line, mutator } = objectOf(one);

            return {
                file: `${member}/${stringOf(file) ?? ''}`,
                line: countOf(line),
                mutator: stringOf(mutator) ?? '',
            };
        }),
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
    const sum = recorded.mutation ?? { detected: 0, range: own.range, survivors: [], unrun: 0 };
    recorded.mutation = {
        detected: sum.detected + own.detected,
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
