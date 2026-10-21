import process from 'node:process';

import { readSettings } from '../../../lint/index.rules.js';
import { planOf } from '../../../lint/kit/project/build-plan.js';
import { watched } from '../../drivers/tsdown/tsdown.js';
import { badge, print, RED, RESET } from '../terminal.js';

export async function dev(): Promise<number> {
    print(`${badge('TYPESCRIPT')} Starting dev mode...\n\n`);
    const project = process.cwd();
    const steps = planOf(project, await readSettings(project));
    if (typeof steps === 'string') {
        print(`${RED}${steps}${RESET}\n`);

        return 1;
    }

    return await watched(steps, project, { run: true });
}
