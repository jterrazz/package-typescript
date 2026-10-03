import process from 'node:process';

import { buildPlanOf } from '../../lint/kit/project/build-plan.js';
import { builtFrom } from './build.js';

// The self rules import every module of src/ to read its fragments; only `node` runs this one.
if (import.meta.main) {
    const root = process.cwd();
    process.exitCode = await builtFrom(
        buildPlanOf(root, {
            declaration: { kind: 'library', platform: 'node' },
            settings: { dev: {}, entries: {} },
        }),
        root,
    );
}
