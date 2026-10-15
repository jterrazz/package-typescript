import type { Context, Finding } from '../../kit/checker/pass.js';
import { SETTINGS_FILE } from '../../kit/project/jterrazz-config.js';
import { declaredAs, SUITE_FOLDER } from '../../kit/project/project-kind.js';
import type { ProjectIdentity } from '../../kit/project/project-kind.js';
import { configFinding as finding } from './config.finding.js';
import { manifestFindings } from './config.manifest.js';

type MonorepoRoot = {
    declaration: null | ProjectIdentity;
    manifestKeys: ReadonlySet<string>;
    problem: null | string;
};

/** The root of a monorepo is a container, never a project: it declares no kind, and npm never publishes it. */
export function monorepoRootFindings(context: Context, root: MonorepoRoot): Finding[] {
    const { declaration, problem } = root;
    const declared =
        declaration === null
            ? []
            : [
                  finding('config/kind-matches-manifest', SETTINGS_FILE, {
                      fix: `drop \`kind\` and \`platform\` from ${SETTINGS_FILE} and keep there the repository's settings alone: each member under \`apps/\` or \`packages/\` declares its own, and tests of the whole repository go to the member at \`${SUITE_FOLDER}/\``,
                      found: `${SETTINGS_FILE} declares ${declaredAs(declaration)}, and package.json lists \`workspaces\`: the root of a monorepo is a container, never a project`,
                  }),
              ];
    const unloaded =
        problem === null
            ? []
            : [
                  finding('config/project-declared', SETTINGS_FILE, {
                      fix: `write ${SETTINGS_FILE} so it loads and declares no \`kind\` and no \`platform\`: the root of a monorepo holds the repository's settings alone, and each member under \`apps/\` or \`packages/\` declares its own`,
                      found: `${SETTINGS_FILE} ${problem}`,
                  }),
              ];

    return [
        ...declared,
        ...unloaded,
        ...manifestFindings(context, '.', 'monorepo', root.manifestKeys),
    ];
}
