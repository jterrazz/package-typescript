import process from 'node:process';

import { planOf, watched } from '../../drivers/tsdown/tsdown.js';
import { badge, print, RED, RESET } from '../check/report/terminal.js';

export async function dev(): Promise<number> {
    print(`${badge('TYPESCRIPT')} Starting dev mode...\n\n`);
    const project = process.cwd();
    const steps = await planOf(project);
    if (typeof steps === 'string') {
        print(`${RED}${steps}${RESET}\n`);

        return 1;
    }

    return await watched(steps, project);
}
