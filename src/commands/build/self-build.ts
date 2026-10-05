import process from 'node:process';

import { readSettings } from '../../../lint/index.rules.js';
import { buildPlanOf, buildSettingsOf } from '../../../lint/kit/project/build-plan.js';
import { builtFrom } from '../../drivers/tsdown/tsdown.js';

if (import.meta.main) {
    const root = process.cwd();
    const { resolved } = await readSettings(root);
    process.exitCode = await builtFrom(
        buildPlanOf(root, {
            declaration: resolved.declaration,
            settings: buildSettingsOf(resolved.sections.typescript).settings,
        }),
        root,
    );
}
