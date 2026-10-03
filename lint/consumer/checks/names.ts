import { join, matchesGlob } from 'node:path';

import type { Context, Finding, Pass } from '../../kit/checker/pass.js';
import { emptyDirectories } from '../../kit/project/empty-directories.js';
import {
    isJsonObject,
    objectOf,
    parsedObject,
    stringRecordOf,
    stringsOf,
} from '../../kit/project/json.js';
import type { JsonObject } from '../../kit/project/json.js';
import { SETTINGS_FILE } from '../../kit/project/jterrazz-config.js';
import { withoutDotSlash } from '../../kit/project/packed-files.js';
import type { Resolution } from '../../kit/project/preset.js';
import { isRepositoryRoot } from '../../kit/project/repository-root.js';
import { workspaceMembers } from '../../kit/project/workspace-members.js';
import { declaredNamesFindings, declaredNamesRules } from './names.declared.js';
import { buildSourcesOf, entryGrammarOf } from './names.entries.js';
import { namesFinding } from './names.lessons.js';
import { LINT_ROOT, lintFoldersOf, lintTreeOf } from './names.lint-tree.js';
import type { LintTree } from './names.lint-tree.js';
import { lsLintConfig, lsLintFindings, runLsLint } from './names.ls-lint.js';

type Disk = Pick<Context, 'exists' | 'read'>;

type Manifest = JsonObject;

type Universal = {
    constructs: ReadonlySet<string>;
    grabBag: ReadonlySet<string>;
    lint: LintTree;
    memberRoots: ReadonlySet<string>;
    shortcuts: ReadonlySet<string>;
    spine: ReadonlySet<string>;
    toolRoots: Readonly<Record<string, string>>;
};

type Settings = {
    problem: null | string;
    roots: Readonly<Record<string, unknown>>;
    universal: Universal;
};

type Named = { fileName?: string; name: string };

const CONSTRUCT_SUFFIX = 'types';

// invariant: a swept root's own name is the toolchain's, never judged: `lib/` is also a grab-bag word.
const SWEPT: ReadonlySet<string> = new Set([
    'apps',
    'bin',
    'lib',
    'lint',
    'packages',
    'specs',
    'src',
    'tests',
]);

const DECLARATION = 'typescript.roots';

// invariant: the only gestures the flows speak; a workspace member owes none of them.
const MAKE_TARGETS = Object.freeze(['install', 'build', 'lint', 'fix', 'test', 'check']);

const MAKEFILE = 'Makefile';

// invariant: a recipe line opens on a tab and never matches; `:=` and `::=` open assignments.
const RULE_LINE = /^(?<targets>[^\s:#=][^:#=]*?)\s*(?:::|:)(?![:=])/u;

// outside: below `app/`, a Next.js directory is a URL the product serves, not a name the tree chose.
const ROUTER_ROOT = 'app';

const unmarked = (name: string): string => name.replace(/^_/u, '').toLowerCase();

// invariant: a name is read segment by segment, split on the hyphen; the `_` marker excuses none.
const isShortcut = (name: string, { shortcuts }: Universal): boolean =>
    unmarked(name)
        .split('-')
        .some((segment) => shortcuts.has(segment));

const hasConstructSuffix = (fileName: string): boolean =>
    fileName.split('.').slice(1, -1).includes(CONSTRUCT_SUFFIX);

const stemOf = (name: string): string => name.split('.')[0] ?? '';

function namesOf(files: readonly string[]): [string, Named][] {
    const named = new Map<string, Named>();

    for (const file of files) {
        const segments = file.split('/');
        if (!SWEPT.has(segments[0] ?? '') || segments.length < 2) {
            continue;
        }

        const routerRoot = segments.indexOf(ROUTER_ROOT, 1);
        const lastJudged = routerRoot === -1 ? segments.length - 1 : routerRoot + 1;
        for (let index = 1; index < Math.min(lastJudged, segments.length - 1); index += 1) {
            const path = segments.slice(0, index + 1).join('/');
            named.set(path, { name: segments[index] ?? '' });
        }
        const fileName = segments.at(-1) ?? '';
        named.set(file, { fileName, name: stemOf(fileName) });
    }

    return [...named].toSorted(([left], [right]) => (left < right ? -1 : 1));
}

// invariant: a word the grab-bag roster already refuses is left to it, so a name is reported once.
function findingsOf(files: readonly string[], universal: Universal): Finding[] {
    const findings: Finding[] = [];

    for (const [path, { fileName, name }] of namesOf(files)) {
        if (universal.grabBag.has(unmarked(name))) {
            findings.push(
                namesFinding('names/no-grab-bag-name', path, {
                    fix: 'name it for the subject it holds, or move what it holds beside the code that uses it',
                    found: `\`${name}\` names no subject — it holds whatever nobody placed`,
                }),
            );
        } else if (
            universal.constructs.has(unmarked(name)) ||
            (fileName !== undefined && hasConstructSuffix(fileName))
        ) {
            findings.push(
                namesFinding('names/no-language-construct-name', path, {
                    fix: 'name it for the subject it holds',
                    found: `\`${fileName ?? name}\` names a construct of the language`,
                }),
            );
        }
        if (isShortcut(name, universal)) {
            findings.push(
                namesFinding('names/no-abbreviated-word', path, {
                    fix: 'spell every word of it whole',
                    found: `\`${name}\` is a word written in half`,
                }),
            );
        }
    }

    return findings;
}

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
        return { problem, roots: {}, universal };
    }

    const { roots } = section;
    if (roots === undefined) {
        return { problem: null, roots: {}, universal };
    }
    if (!isJsonObject(roots)) {
        return {
            problem: `holds a \`${DECLARATION}\` that is not an object mapping each folder to its reason`,
            roots: {},
            universal,
        };
    }

    return { problem: null, roots, universal };
}

function targetsOfExports(exports: unknown): string[] {
    if (typeof exports === 'string') {
        return [exports];
    }
    if (exports === null || typeof exports !== 'object') {
        return [];
    }

    return Object.values(exports).flatMap((value) => targetsOfExports(value));
}

function lintOutputsOf(disk: Disk, unit: string): string[] {
    return [...buildSourcesOf(disk, unit)]
        .filter(([, source]) => source.startsWith('lint/'))
        .map(([name]) => `dist/${name}`);
}

function filesPublish(files: readonly unknown[], path: string): boolean {
    let published = false;
    for (const entry of files) {
        if (typeof entry !== 'string') {
            continue;
        }
        const excludes = entry.startsWith('!');
        const pattern = withoutDotSlash(excludes ? entry.slice(1) : entry).replace(/\/$/u, '');
        if (path === pattern || path.startsWith(`${pattern}/`) || matchesGlob(path, pattern)) {
            published = !excludes;
        }
    }

    return published;
}

// invariant: a `lint/` nothing publishes holds rules no consumer receives: `src/` under another name.
function shipsLint(disk: Disk, manifest: Manifest, unit: string): boolean {
    const files: unknown[] = Array.isArray(manifest.files) ? manifest.files : [];
    const byFiles = files.some(
        (entry) =>
            typeof entry === 'string' && /^(?:\.\/)?lint(?:\/|$)/u.test(entry.replace(/^!.*/u, '')),
    );
    const targets = [
        ...targetsOfExports(manifest.exports),
        ...targetsOfExports(manifest.bin),
        ...targetsOfExports(manifest.main),
    ].map((target) => withoutDotSlash(target));
    const byExports = targets.some((target) => /^lint(?:\/|$)/u.test(target));
    const byBuild = lintOutputsOf(disk, unit).some(
        (output) =>
            targets.some((target) => target.startsWith(`${output}.`)) ||
            filesPublish(files, `${output}.js`),
    );

    return byFiles || byExports || byBuild;
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
                  fix: `move it under src/, or declare it in ${prefix}${SETTINGS_FILE}'s \`${DECLARATION}\` with its reason`,
                  found: `\`${prefix}${root}/\` is a root outside the spine`,
              },
    );
}

function declaredRootFindings(
    declared: Settings['roots'],
    roots: ReadonlySet<string>,
    prefix: string,
): Finding[] {
    const findings: Finding[] = [];

    for (const [root, reason] of Object.entries(declared).toSorted(([left], [right]) =>
        left < right ? -1 : 1,
    )) {
        if (typeof reason !== 'string' || reason.trim() === '') {
            findings.push(
                namesFinding('names/declared-root-states-its-reason', `${prefix}${root}/`, {
                    fix: 'say why the repository keeps it',
                    found: `\`${prefix}${root}/\` is declared in ${prefix}${SETTINGS_FILE}'s \`${DECLARATION}\` with no reason`,
                }),
            );
        } else if (!roots.has(root)) {
            findings.push(
                namesFinding('names/declared-root-holds-files', `${prefix}${root}/`, {
                    fix: 'delete the entry',
                    found: `\`${prefix}${root}/\` is declared in ${prefix}${SETTINGS_FILE}'s \`${DECLARATION}\` and holds no file`,
                }),
            );
        }
    }

    return findings;
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
        Object.hasOwn(declared, root);

    return [
        ...findings,
        ...entryGrammarOf(disk, unit, { files, prefix }),
        ...lintTreeOf(files, { prefix, tree: lint, unit }),
        ...[...roots]
            .toSorted((left, right) => (left < right ? -1 : 1))
            .filter((root) => !isCodified(root))
            .map((root) => foreignRoot(root, prefix)),
        ...declaredRootFindings(declared, roots, prefix),
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

function targetsOf(text: string): ReadonlySet<string> {
    const targets = new Set<string>();
    for (const line of text.split('\n')) {
        const match = RULE_LINE.exec(line);
        for (const target of match?.groups?.targets?.split(/\s+/u) ?? []) {
            targets.add(target);
        }
    }

    return targets;
}

// invariant: asked only where a `.git` stands beside the root, so a member, a fixture or a bare directory is never asked.
function makefileOf({ read, root }: Context, files: readonly string[]): Finding[] {
    if (!isRepositoryRoot(root)) {
        return [];
    }
    const gestures = `${MAKE_TARGETS.slice(0, -1).join(', ')} and ${MAKE_TARGETS.at(-1) ?? ''}`;
    if (!files.includes(MAKEFILE)) {
        return [
            namesFinding('names/repository-has-makefile', MAKEFILE, {
                fix: `write a Makefile whose rules answer \`make\` ${gestures}`,
                found: 'the repository has no Makefile',
            }),
        ];
    }

    const targets = targetsOf(read(join(root, MAKEFILE)) ?? '');

    return MAKE_TARGETS.filter((target) => !targets.has(target)).map((target) =>
        namesFinding('names/makefile-answers-every-gesture', MAKEFILE, {
            fix: `write its rule — every repository answers \`make\` ${gestures}`,
            found: `\`make ${target}\` has no rule`,
        }),
    );
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

async function laidOut(
    context: Context,
    { swept, tree }: { swept: readonly string[]; tree: LintTree },
): Promise<{ findings: Finding[]; problems: string[] }> {
    const units = ['', ...workspaceMembers(context.root).map((member) => `${member}/`)];
    const { failures, problem } = runLsLint(
        context.value('--ls-lint', 'ls-lint'),
        context.root,
        lsLintConfig({ ignorePatterns: context.ignorePatterns, tree, units }),
    );
    const declared = declaredNamesRules(await context.config());
    const own = declaredNamesFindings(context, { rules: declared.rules, swept, units });

    return {
        findings: [
            ...(declared.problem === null ? [] : [configFinding(SETTINGS_FILE, declared.problem)]),
            ...lsLintFindings(context.root, { failures, swept, tree, units }),
            ...own.findings,
        ],
        problems: [...(problem === null ? [] : [problem]), ...own.problems],
    };
}

export const names: Pass = Object.freeze({
    async check(context) {
        const files = context.files();
        const settings = settingsOf(await context.config());
        const layout = await laidOut(context, { swept: files, tree: settings.universal.lint });

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
