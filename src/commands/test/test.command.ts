import process from 'node:process';

import { npmTest } from '../../drivers/npm/npm.js';
import { provenAsked, provenRun } from '../check/report/proven.js';

export async function test(args: readonly string[]): Promise<number> {
    const project = process.cwd();

    return await provenRun(project, provenAsked('test', args), async () => await npmTest(project));
}
