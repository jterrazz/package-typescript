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
import { branchBaseTreeOf } from '../mutation/branch.js';
import { scriptRunOf, testFilesReachedIn, testScriptOf } from '../mutation/record/test-files.js';
import type { TestFiles } from '../mutation/record/test-files.js';
import { badge, print } from '../terminal.js';
import { secondsSince } from '../timing.js';

async function recordedTest(project: string, args: readonly string[]): Promise<number> {
    const before = fileResultsOf(project);
    const from = performance.now();
    const status = await npmTest(project, args);
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

async function selectedTest(project: string, cold: boolean, script: string): Promise<number> {
    const selection: TestFiles = cold
        ? { kind: 'every', reason: 'asked --cold' }
        : testFilesReachedIn(project);
    const { args, line } = scriptRunOf(selection, script);
    const status = args === undefined ? 0 : await recordedTest(project, args);
    print(`${badge('TYPESCRIPT')} ${line}\n`);

    return status;
}

export async function test(args: readonly string[]): Promise<number> {
    const project = process.cwd();
    const asked = provenAsked('test', args);
    return await provenRun(
        project,
        { ...asked, scope: branchBaseTreeOf(project) },
        async () => await selectedTest(project, asked.cold, testScriptOf(project)),
    );
}
