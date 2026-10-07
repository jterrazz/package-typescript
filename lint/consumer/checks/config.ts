import { join } from 'node:path';

import type { Context, Finding, Pass } from '../../kit/checker/pass.js';
import {
    namesBeside,
    OXFMT_CONFIG,
    OXFMT_CONFIG_NAMES,
    OXLINT_CONFIG,
    OXLINT_CONFIG_NAMES,
} from '../../kit/project/editor-config-names.js';
import type { EditorFile } from '../../kit/project/editor-files.js';
import {
    derivedEditorFiles,
    editorFileText,
    holdsEditorFile,
    tsconfigAdditionsOf,
} from '../../kit/project/editor-files.js';
import { parsedObject } from '../../kit/project/json.js';
import { SETTINGS_FILE } from '../../kit/project/jterrazz-config.js';
import {
    KINDS,
    listed,
    PLATFORMS,
    SUITE_FOLDER,
    SUITE_PLATFORMS,
} from '../../kit/project/project-kind.js';
import type { ProjectIdentity, ProjectKind } from '../../kit/project/project-kind.js';
import { workspaceMembers } from '../../kit/project/workspace-members.js';
import { configFinding as finding } from './config.finding.js';
import { manifestGap, NAMED } from './config.manifest.js';
import { standardLogic } from './config.standard.js';
import { synchronousLoad } from './config.synchronous.js';

const TOOL_CONFIGS: Readonly<Record<string, readonly string[]>> = Object.freeze({
    'dependency-cruiser': [
        '.dependency-cruiser.cjs',
        '.dependency-cruiser.js',
        '.dependency-cruiser.mjs',
    ],
    knip: ['knip.json', 'knip.jsonc', '.knip.json', '.knip.jsonc', 'knip.config.ts', 'knip.ts'],
    'ls-lint': ['.ls-lint.yml', '.ls-lint.yaml'],
    oxfmt: namesBeside(OXFMT_CONFIG_NAMES, OXFMT_CONFIG),
    oxlint: namesBeside(OXLINT_CONFIG_NAMES, OXLINT_CONFIG),
    stryker: [
        'stryker.config.json',
        'stryker.config.js',
        'stryker.config.mjs',
        'stryker.config.ts',
        'stryker.conf.json',
        'stryker.conf.js',
    ],
    tsdown: [
        'tsdown.config.ts',
        'tsdown.config.mts',
        'tsdown.config.cts',
        'tsdown.config.js',
        'tsdown.config.mjs',
        'tsdown.config.cjs',
    ],
});

type Unit = {
    declaration: null | ProjectIdentity;
    // invariant: true for the workspace root's own `specs/`, the one member that may declare no kind.
    suite: boolean;
    files: Readonly<Record<string, EditorFile>>;
    path: string;
    problem: null | string;
    tsconfigProblem: null | string;
};

const prefixed = (unit: string, file: string): string => (unit === '.' ? file : `${unit}/${file}`);

function manifestOf(context: Context, unit: string): Readonly<Record<string, unknown>> {
    try {
        return parsedObject(context.read(join(context.root, unit, 'package.json')) ?? '{}');
    } catch {
        return {};
    }
}

function declarationFindings(context: Context, unit: Unit): Finding[] {
    const settings = prefixed(unit.path, SETTINGS_FILE);
    const { declaration } = unit;
    if (declaration === null) {
        return [
            finding('config/project-declared', settings, {
                fix: `write \`export default defineConfig({ kind, platform })\` from \`@jterrazz/typescript/config\` in ${settings} — the kind one of ${listed(KINDS)}, the platform one of ${listed(PLATFORMS)}; a workspace's own suite at \`${SUITE_FOLDER}/\` declares its platform alone, one of ${listed(SUITE_PLATFORMS)}`,
                found: context.exists(join(context.root, settings))
                    ? `${settings} ${unit.problem ?? 'declares no `kind`'}`
                    : `${settings} is missing`,
            }),
        ];
    }
    if (declaration.kind === null && !unit.suite) {
        return [
            finding('config/project-declared', settings, {
                fix: `declare its kind in ${settings} — one of ${listed(KINDS)} — or, for tests of the whole repository, keep them in the workspace member at \`${SUITE_FOLDER}/\``,
                found: `${settings} declares a platform and no kind, which only a workspace's own suite at \`${SUITE_FOLDER}/\` may`,
            }),
        ];
    }

    return manifestFindings(context, unit.path, declaration.kind);
}

function tsconfigFindings(unit: Unit): Finding[] {
    if (unit.tsconfigProblem === null) {
        return [];
    }
    const settings = prefixed(unit.path, SETTINGS_FILE);

    return [
        finding('config/tsconfig-addition-reasoned', settings, {
            fix: `state why under \`typescript.tsconfig.reason\` in ${settings}, or move the option into the platform's preset`,
            found: `${settings} ${unit.tsconfigProblem}, so no tsconfig.json is derived from it`,
        }),
    ];
}

function manifestFindings(context: Context, unit: string, kind: null | ProjectKind): Finding[] {
    const gap = manifestGap(kind, manifestOf(context, unit));
    if (gap === null) {
        return [];
    }
    const path = prefixed(unit, 'package.json');

    return [
        finding('config/kind-matches-manifest', path, {
            fix: gap.fix,
            found: `${prefixed(unit, SETTINGS_FILE)} declares ${kind === null ? 'no kind, a suite' : NAMED[kind]}, and ${path} ${gap.owes}`,
        }),
    ];
}

const shownOf = (file: EditorFile, text: string): string =>
    'text' in file ? text.trim().replaceAll(/\n+/gu, ' ') : text.trim();

const workspaceRootFindings = (path: string, name: string, written: null | string): Finding[] =>
    written === null
        ? []
        : [
              finding('config/editor-file-in-its-unit', path, {
                  fix: `delete it: each member keeps its own ${name}, derived from its own ${SETTINGS_FILE}`,
                  found: `${path} sits at a workspace root, which declares no platform to derive it from`,
              }),
          ];

function editorFindings(
    context: Context,
    unit: Unit,
): { findings: Finding[]; writes: { path: string; text: string }[] } {
    const findings: Finding[] = [];
    const writes: { path: string; text: string }[] = [];
    for (const [name, expected] of Object.entries(unit.files).toSorted(([left], [right]) =>
        left < right ? -1 : 1,
    )) {
        const path = prefixed(unit.path, name);
        const written = context.read(join(context.root, path));
        if (unit.path !== '.' && expected.scope === 'repository') {
            if (written !== null) {
                findings.push(
                    finding('config/editor-file-in-its-unit', path, {
                        fix: `delete it: the root's ${name} derives this member's own from ${prefixed(unit.path, SETTINGS_FILE)}`,
                        found: `${path} is a second ${name} inside the repository, and replaces the root's in its subtree`,
                    }),
                );
            }
            continue;
        }
        if (expected.scope === 'unit' && unit.declaration?.kind === 'workspace') {
            findings.push(...workspaceRootFindings(path, name, written));
            continue;
        }
        if (written !== null && holdsEditorFile(written, expected)) {
            continue;
        }
        const text = editorFileText(expected);
        findings.push(
            finding(
                'config/editor-file-derived',
                path,
                {
                    fix: `run \`typescript fix\`, which writes it: ${shownOf(expected, text)}`,
                    found:
                        written === null
                            ? `${path} is missing`
                            : `${path} says something other than the file ${prefixed(unit.path, SETTINGS_FILE)} derives`,
                },
                context.fix,
            ),
        );
        if (context.fix) {
            writes.push({ path: join(context.root, path), text });
        }
    }

    return { findings, writes };
}

const SECOND_VITEST_CONFIG = /^vitest\.[^.]+\.config\.[cm]?[jt]s$|^vitest\.workspace\.[cm]?[jt]s$/u;

function toolConfigFindings(context: Context, unit: string): Finding[] {
    const vitest = (context.list(join(context.root, unit)) ?? [])
        .filter((name) => SECOND_VITEST_CONFIG.test(name))
        .map((name) =>
            finding('config/no-tool-config', prefixed(unit, name), {
                fix: `move what it sets into ${prefixed(unit, SETTINGS_FILE)}, under the section its owner reads, and delete it`,
                found: `${prefixed(unit, name)} is a second vitest config, which only the toolchain's command runs`,
            }),
        );

    return [
        ...vitest,
        ...Object.entries(TOOL_CONFIGS).flatMap(([tool, names]) =>
            names
                .map((name) => prefixed(unit, name))
                .filter((path) => context.exists(join(context.root, path)))
                .map((path) =>
                    finding('config/no-tool-config', path, {
                        fix: `move what it sets into ${prefixed(unit, SETTINGS_FILE)}, under the section its owner reads, and delete it`,
                        found: `${path} configures ${tool}, which only the toolchain's command runs`,
                    }),
                ),
        ),
    ];
}

async function unitsOf(context: Context): Promise<{ findings: Finding[]; units: Unit[] }> {
    const root = await context.config();
    const members = workspaceMembers(context.root);
    const declaring = members.filter((member) =>
        context.exists(join(context.root, member, SETTINGS_FILE)),
    );
    const workspace = root.resolved.declaration?.kind === 'workspace';
    const undeclared = workspace ? members.filter((member) => !declaring.includes(member)) : [];
    const units = await Promise.all(
        ['.', ...declaring].map(async (path): Promise<Unit> => {
            const { problem, resolved } =
                path === '.' ? root : await context.config(join(context.root, path));
            const tsconfig = tsconfigAdditionsOf(resolved.sections.typescript);
            const files = derivedEditorFiles(
                resolved.presets.flatMap((preset) =>
                    preset.files === undefined ? [] : [preset.files],
                ),
                tsconfig.additions,
            );

            return {
                declaration: problem === null ? resolved.declaration : null,
                files,
                path,
                problem,
                suite: workspace && path === SUITE_FOLDER,
                tsconfigProblem: tsconfig.problem,
            };
        }),
    );

    return {
        findings: undeclared.map((member) =>
            finding('config/project-declared', prefixed(member, SETTINGS_FILE), {
                fix: `write ${prefixed(member, SETTINGS_FILE)} declaring the member's own kind and platform`,
                found: `${member} is a member of a workspace, and declares no kind of its own`,
            }),
        ),
        units,
    };
}

export const config: Pass = Object.freeze({
    async check(context) {
        const { findings: members, units } = await unitsOf(context);
        const findings = [...members];
        const writes: { path: string; text: string }[] = [];
        for (const unit of units) {
            const editor =
                unit.declaration === null
                    ? { findings: [], writes: [] }
                    : editorFindings(context, unit);
            const synchronous = await synchronousLoad(context, unit);
            findings.push(
                ...declarationFindings(context, unit),
                ...synchronous,
                ...tsconfigFindings(unit),
                ...editor.findings,
                ...toolConfigFindings(context, unit.path),
                ...standardLogic(context, unit.path),
            );
            writes.push(...editor.writes);
        }

        return { findings, writes };
    },
});
