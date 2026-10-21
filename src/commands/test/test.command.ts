import process from 'node:process';

import { npmTest } from '../../drivers/npm/npm.js';
import { headOf } from '../check/report/gate-verdict.js';
import {
    fileOutcomesOf,
    fileResultsOf,
    outcomesRecorded,
    testOutcomeOf,
} from '../check/report/outcomes.js';
import { provenAsked, provenRun } from '../check/report/proven.js';
import { secondsSince } from '../timing.js';

async function recordedTest(project: string): Promise<number> {
    const before = fileResultsOf(project);
    const from = performance.now();
    const status = await npmTest(project);
    const now = new Date();
    const head = headOf(project);
    outcomesRecorded(
        project,
        [
            testOutcomeOf({ head, seconds: secondsSince(from), status }, now),
            ...fileOutcomesOf({ after: fileResultsOf(project), before }, { head, now }),
        ],
        now,
    );

    return status;
}

export async function test(args: readonly string[]): Promise<number> {
    const project = process.cwd();

    return await provenRun(
        project,
        provenAsked('test', args),
        async () => await recordedTest(project),
    );
}
