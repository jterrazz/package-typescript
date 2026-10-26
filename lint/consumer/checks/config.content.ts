import { join } from 'node:path';

import type { Context, Finding } from '../../kit/checker/pass.js';
import { SETTINGS_FILE } from '../../kit/project/studio-config.js';
import { configFinding as finding, prefixed } from './config.finding.js';

// invariant: a content repository holds no code, so it holds no manifest: a `package.json` beside the declaration makes it a project, which declares the kind it is.
export function contentFindings(context: Context, unit: string): Finding[] {
    const manifest = prefixed(unit, 'package.json');

    return context.exists(join(context.root, manifest))
        ? [
              finding('config/kind-matches-manifest', manifest, {
                  fix: `delete ${manifest} if the repository holds no code, or declare the kind the project is in ${prefixed(unit, SETTINGS_FILE)}`,
                  found: `${prefixed(unit, SETTINGS_FILE)} declares a content repository, and ${manifest} exists: a manifest makes it a project`,
              }),
          ]
        : [];
}
