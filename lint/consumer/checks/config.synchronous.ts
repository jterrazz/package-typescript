import { join } from 'node:path';

import type { Context, Finding } from '../../kit/checker/pass.js';
import { SETTINGS_FILE, synchronousLoadProblem } from '../../kit/project/jterrazz-config.js';
import { configFinding } from './config.finding.js';

/** The unit's settings file, when it loads only asynchronously — the oxlint rules load it synchronously; one that loads in neither way is the declaration's finding. */
export async function synchronousLoad(
    context: Context,
    unit: { path: string; problem: null | string },
): Promise<Finding[]> {
    const path = unit.path === '.' ? SETTINGS_FILE : `${unit.path}/${SETTINGS_FILE}`;
    const problem =
        unit.problem === null ? await synchronousLoadProblem(join(context.root, unit.path)) : null;

    return problem === null
        ? []
        : [
              configFinding('config/settings-load-synchronously', path, {
                  fix: `drop what keeps ${path} from loading synchronously — a top-level \`await\` most often: \`ownPresets\` and every preset are synchronous`,
                  found: `${path} does not load synchronously, as the oxlint rules load it, so they would judge on its defaults: ${problem}`,
              }),
          ];
}
