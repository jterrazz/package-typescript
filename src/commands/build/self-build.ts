import process from 'node:process';

import { readSettings } from '../../../lint/index.rules.js';
import { planOf } from '../../../lint/kit/project/build-plan.js';
import { builtFrom } from '../../drivers/tsdown/tsdown.js';
import { refusedWhileGated } from '../gate-lock/lock.js';

if (import.meta.main) {
    const root = process.cwd();
    const gated = refusedWhileGated(root, 'a build');
    const steps = planOf(root, await readSettings(root));
    if (gated !== undefined) {
        process.stderr.write(`${gated}\n`);
        process.exitCode = 1;
    } else if (typeof steps === 'string') {
        process.stderr.write(`${steps}\n`);
        process.exitCode = 1;
    } else {
        process.exitCode = await builtFrom(steps, root);
    }
}
