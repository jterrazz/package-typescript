import process from 'node:process';

import { readSettings } from '../../../lint/index.rules.js';
import { planOf } from '../../../lint/kit/project/build-plan.js';
import { builtFrom } from '../../drivers/tsdown/tsdown.js';

if (import.meta.main) {
    const root = process.cwd();
    const steps = planOf(root, await readSettings(root));
    if (typeof steps === 'string') {
        process.stderr.write(`${steps}\n`);
        process.exitCode = 1;
    } else {
        process.exitCode = await builtFrom(steps, root);
    }
}
