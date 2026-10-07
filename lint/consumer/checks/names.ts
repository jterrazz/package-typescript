import { join } from 'node:path';

import type { Context, Finding, Pass } from '../../kit/checker/pass.js';
import { emptyDirectories } from '../../kit/project/empty-directories.js';
import { objectOf, parsedObject, stringRecordOf, stringsOf } from '../../kit/project/json.js';
import type { JsonObject } from '../../kit/project/json.js';
import { SETTINGS_FILE } from '../../kit/project/jterrazz-config.js';
import type { Resolution } from '../../kit/project/preset.js';
import { workspaceMembers } from '../../kit/project/workspace-members.js';
import { declaredNamesFindings, declaredNamesRules } from './names.declared.js';
import { entryGrammarOf } from './names.entries.js';
import { namesFinding } from './names.lessons.js';
import { LINT_ROOT, lintFoldersOf, lintTreeOf, TOPS } from './names.lint-tree.js';
import type { LintTree } from './names.lint-tree.js';
import { lsLintConfig, lsLintFindings, runLsLint } from './names.ls-lint.js';
import type { LintTrees, MemberToolRoots } from './names.ls-lint.js';
import { makefileOf } from './names.makefile.js';
import { shipsLint } from './names.published-lint.js';
import {
    declaredRootsFindings,
    declaredRootsOf,
    isDeclaredRoot,
    NO_DECLARED_ROOTS,
} from './names.roots.js';
import type { DeclaredRoots } from './names.roots.js';
import { findingsOf } from './names.universal.js';
import type { Universal } from './names.universal.js';

type Disk = Pick<Context, 'exists' | 'read'>;

type Manifest = JsonObject;

type Settings = {
    problem: null | string;
    roots: DeclaredRoots;
    universal: Universal;
};

function manifestOf(disk: Disk, unit: string): Manifest {
    const manifest = disk.read(join(unit, 'package.json'));
    if (manifest === null) {
        return {};
    }

    try {
        return parsedObject(manifest);
    } catch {
        return {};
    }
}

const set = (value: unknown): ReadonlySet<string> => new Set(stringsOf(value));

function universalOf(section: Readonly<Record<string, unknown>>): Universal {
    const words = objectOf(section.words);

    return {
        constructs: set(words.constructs),
        grabBag: set(words.grabBag),
        lint: lintFoldersOf(section.lint),
        memberRoots: set(section.memberRoots),
        shortcuts: set(words.shortcuts),
        spine: set(section.spine),
        toolRoots: stringRecordOf(section.toolRoots),
    };
}

function settingsOf({ problem, resolved }: Resolution): Settings {
    const section = resolved.sections.typescript ?? {};
    const universal = universalOf(section);
    if (problem !== null) {
        return { problem, roots: NO_DECLARED_ROOTS, universal };
    }

    return { ...declaredRootsOf(section), universal };
}

function foreignRoot(root: string, prefix: string): Finding {
    const manifestPath = `${prefix}package.json`;

    return namesFinding(
        'names/no-undeclared-root-folder',
        `${prefix}${root}/`,
        root === LINT_ROOT
            ? {
                  fix: 'ship it, or move it under src/',
                  found: `\`${prefix}lint/\` holds the lint rules a package ships, and neither ${manifestPath} nor its build publishes it`,
              }
            : {
                  fix: `move it under src/, or declare it in ${prefix}${SETTINGS_FILE}'s \`typescript.roots\` with its reason`,
                  found: `\`${prefix}${root}/\` is a root outside the spine`,
              },
    );
}

function spineOf(
    disk: Disk,
    unit: string,
    {
        files,
        prefix = '',
        settings,
    }: { files: readonly string[]; prefix?: string; settings: Settings },
): Finding[] {
    const manifest = manifestOf(disk, unit);
    const findings: Finding[] = [];
    const roots = new Set<string>();
    const declared = settings.roots;
    if (settings.problem !== null) {
        findings.push(configFinding(`${prefix}${SETTINGS_FILE}`, settings.problem));
    }

    for (const file of files) {
        const [first = '', ...rest] = file.split('/');
        if (rest.length === 0 || first.startsWith('.')) {
            continue;
        }
        roots.add(first);
    }

    const { lint, memberRoots, spine, toolRoots } = settings.universal;
    const isCodified = (root: string): boolean =>
        (spine.has(root) && (root !== LINT_ROOT || shipsLint(disk, manifest, unit))) ||
        memberRoots.has(root) ||
        Object.hasOwn(toolRoots, root) ||
        isDeclaredRoot(declared, root);

    return [
        ...findings,
        ...entryGrammarOf(disk, unit, { files, prefix }),
        ...lintTreeOf(files, { prefix, tree: lint, unit }),
        ...[...roots]
            .toSorted((left, right) => (left < right ? -1 : 1))
            .filter((root) => !isCodified(root))
            .map((root) => foreignRoot(root, prefix)),
        ...declaredRootsFindings(declared, { prefix, roots }),
    ];
}

async function spinesOf(
    context: Context,
    { files, settings }: { files: readonly string[]; settings: Settings },
): Promise<Finding[]> {
    const { root } = context;
    const members = workspaceMembers(root);
    const memberOf = (file: string): string | undefined =>
        members.find((member) => file.startsWith(`${member}/`));
    const memberSettings = await Promise.all(
        members.map(async (member) => settingsOf(await context.config(join(root, member)))),
    );

    return [
        ...spineOf(context, root, {
            files: files.filter((file) => memberOf(file) === undefined),
            settings,
        }),
        ...members.flatMap((member, index) =>
            spineOf(context, join(root, member), {
                files: files
                    .filter((file) => file.startsWith(`${member}/`))
                    .map((file) => file.slice(member.length + 1)),
                prefix: `${member}/`,
                settings: memberSettings[index] ?? settings,
            }),
        ),
    ];
}

function emptyDirectoryFinding(path: string): Finding {
    return namesFinding('names/no-empty-directory', `${path}/`, {
        fix: 'delete it — `typescript fix` does — or put the file it was made for in it',
        found: `\`${path}/\` holds no file`,
    });
}

function configFinding(path: string, problem: string): Finding {
    return namesFinding('names/jterrazz-config-loads', path, {
        fix: `correct ${SETTINGS_FILE} until it loads and each preset and section has its declared shape, then run again`,
        found: `\`${path}\` ${problem}`,
    });
}

// Stryker disable next-line MethodExpression: a kind's standard lists the three audiences of the lint tree, or none
const keepsTree = (tree: LintTree): boolean => TOPS.some((top) => tree[top].length > 0);

// invariant: a unit is held to the lint tree its own kind lists; one whose kind ships no lint rules lists none, and its `lint/` is judged as a root alone.
async function lintTreesOf(context: Context, units: readonly string[]): Promise<LintTrees> {
    const trees = await Promise.all(
        units.map(
            async (unit) =>
                [
                    unit,
                    settingsOf(await context.config(join(context.root, unit))).universal.lint,
                ] as const,
        ),
    );

    return Object.fromEntries(trees.filter(([, tree]) => keepsTree(tree)));
}

// invariant: a member's tool roots sit under the root's code roots (`apps/`, `packages/`), whose names the kebab law judges; each unit's own standard exempts them — at the root, where no code root reaches them, to no effect.
async function memberToolRootsOf(
    context: Context,
    units: readonly string[],
): Promise<MemberToolRoots> {
    const toolRootsOf = async (prefix: string): Promise<readonly [string, string[]]> => {
        const { universal } = settingsOf(await context.config(join(context.root, prefix)));

        return [prefix, Object.keys(universal.toolRoots)];
    };
    const roots = await Promise.all(units.map(async (prefix) => await toolRootsOf(prefix)));

    return Object.fromEntries(roots);
}

async function laidOut(
    context: Context,
    swept: readonly string[],
): Promise<{ findings: Finding[]; problems: string[] }> {
    const units = ['', ...workspaceMembers(context.root).map((member) => `${member}/`)];
    const trees = await lintTreesOf(context, units);
    const toolRoots = await memberToolRootsOf(context, units);
    const { failures, problem } = runLsLint(
        context.value('--ls-lint', 'ls-lint'),
        context.root,
        lsLintConfig({ ignorePatterns: context.ignorePatterns, toolRoots, trees, units }),
    );
    const declared = declaredNamesRules(await context.config());
    const own = declaredNamesFindings(context, { rules: declared.rules, swept, units });

    return {
        findings: [
            ...(declared.problem === null ? [] : [configFinding(SETTINGS_FILE, declared.problem)]),
            ...lsLintFindings(context.root, { failures, swept, trees, units }),
            ...own.findings,
        ],
        problems: [...(problem === null ? [] : [problem]), ...own.problems],
    };
}

export const names: Pass = Object.freeze({
    async check(context) {
        const files = context.files();
        const settings = settingsOf(await context.config());
        const layout = await laidOut(context, files);

        return {
            ...(layout.problems.length === 0 ? {} : { failed: true, lines: layout.problems }),
            findings: [
                ...findingsOf(files, settings.universal),
                ...layout.findings,
                ...(await spinesOf(context, { files, settings })),
                ...makefileOf(context, files),
                ...emptyDirectories(context.root, { ignorePatterns: context.ignorePatterns }).map(
                    (path) => emptyDirectoryFinding(path),
                ),
            ],
        };
    },
    prepare: (context) => ({
        removals: emptyDirectories(context.root, { ignorePatterns: context.ignorePatterns }).map(
            (directory) => ({ directory, line: `removed  ${directory}/  an empty directory` }),
        ),
    }),
    valued: ['--ls-lint'],
});
