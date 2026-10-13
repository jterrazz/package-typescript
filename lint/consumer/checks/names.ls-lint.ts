import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import type { Dirent } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';

import { refusal } from '../../kit/catalogue/lesson.js';
import type { Finding } from '../../kit/checker/pass.js';
import { runTool } from '../../kit/checker/tool-run.js';
import {
    CODE_SPECIAL_FOLDERS,
    GROUND_FOLDERS,
    SPECIAL_FOLDERS,
    TESTS_FOLDER,
} from '../../kit/project/ground.js';
import { objectOf } from '../../kit/project/json.js';
import { LINT_ROOT, TOPS } from './names.lint-tree.js';
import type { LintTree, Top } from './names.lint-tree.js';
import { placementFindingOf } from './names.placement.js';
import type { Failed } from './names.placement.js';

type Rules = Record<string, string>;

export type Failures = Readonly<Record<string, Readonly<Record<string, readonly string[]>>>>;

const KEBAB = String.raw`_?[a-z0-9]+(-[a-z0-9]+)*`;

const FRAMEWORK_ROUTE_SEGMENT = String.raw`\[{1,2}(\.{3})?[A-Za-z0-9]+\]{1,2}|\([a-z0-9-]+\)|@[a-z0-9-]+`;

const directoryOf = (special: readonly string[]): string =>
    `(?:${KEBAB}|${FRAMEWORK_ROUTE_SEGMENT}|${special.join('|')})`;

const CODE_DIRECTORY = directoryOf(CODE_SPECIAL_FOLDERS);

const SPECS_DIRECTORY = directoryOf(SPECIAL_FOLDERS);

const CODE_ROOTS = ['apps', 'bin', 'lib', 'packages', 'src', 'tests'];

const ANY_NAME: Rules = Object.freeze({});

const IGNORED = [
    'node_modules',
    '**/node_modules',
    'dist',
    '**/.*',
    // invariant: the ground a test stands on is its own — under a specs tree, or in a module's tests folder; anywhere else it is a folder like any.
    ...GROUND_FOLDERS.flatMap((folder) => [
        `**/specs/**/${folder}`,
        `**/${TESTS_FOLDER}/**/${folder}`,
    ]),
];

const MODULE_EXTENSIONS = ['.cjs', '.cts', '.js', '.jsx', '.mjs', '.mts', '.ts', '.tsx'];

const REFUSED_FILE_BY_FILE = 'regex:/';

const COMPOSERS: Rules = Object.freeze({
    '.*': REFUSED_FILE_BY_FILE,
    ...Object.fromEntries(MODULE_EXTENSIONS.map((extension) => [extension, `regex:${KEBAB}`])),
});

const ENTRIES: Rules = Object.freeze({
    '.*': REFUSED_FILE_BY_FILE,
    ...Object.fromEntries(MODULE_EXTENSIONS.map((extension) => [extension, 'regex:index'])),
});

const ROOT_FILES: Readonly<Record<Top, Rules>> = Object.freeze({
    consumer: { '.*': 'exists:0' },
    kit: { '.*': 'exists:0' },
    self: COMPOSERS,
});

function lintTreeRules(prefix: string, tree: LintTree): Record<string, Rules> {
    const lint = `${prefix}${LINT_ROOT}`;
    const rules: Record<string, Rules> = {
        [lint]: { ...ENTRIES, '.dir': `regex:${LINT_ROOT}` },
    };
    for (const top of TOPS) {
        rules[`${lint}/${top}`] = { ...ROOT_FILES[top], '.dir': `regex:${top}` };
        rules[`${lint}/${top}/{${tree[top].join(',')}}`] = {
            '.*': 'regex:.+',
            '.dir': `regex:${CODE_DIRECTORY}`,
        };
    }
    rules[`${lint}/${TESTS_FOLDER}`] = { '.*': 'regex:.+', '.dir': `regex:${CODE_DIRECTORY}` };

    return rules;
}

function skillRules(prefix: string): Record<string, Rules> {
    return {
        [`${prefix}skills`]: { '.*': 'exists:0', '.dir': 'regex:skills' },
        [`${prefix}skills/*`]: {
            '.*': 'exists:0',
            '.*.*': 'exists:0',
            '.dir': `regex:${KEBAB}`,
            '.md': 'regex:SKILL',
        },
        [`${prefix}skills/*/*`]: { '.*': 'exists:0', '.dir': 'regex:references' },
        [`${prefix}skills/*/references`]: {
            '.*': 'exists:0',
            '.dir': 'exists:0',
            '.md': `regex:${KEBAB}`,
        },
    };
}

export function ignoredOf(ignorePatterns: readonly string[]): string[] {
    return [...IGNORED, ...ignorePatterns.map((pattern) => pattern.replace(/\/\*\*$/u, ''))];
}

/** The lint tree of each unit that keeps one, keyed by the unit's prefix — a unit whose kind ships no lint rules has none. */
export type LintTrees = Readonly<Record<string, LintTree>>;

/** The tool roots of each workspace member, keyed by the member's prefix: a folder a tool reads by its own grammar — Prisma's timestamped migrations — that the root's code roots would otherwise reach. */
export type MemberToolRoots = Readonly<Record<string, readonly string[]>>;

function toolRootRules(toolRoots: MemberToolRoots): Record<string, Rules> {
    return Object.fromEntries(
        Object.entries(toolRoots).flatMap(([prefix, roots]) =>
            roots
                .filter((root) => !CODE_ROOTS.includes(root))
                .map((root): [string, Rules] => [`${prefix}${root}`, ANY_NAME]),
        ),
    );
}

export function lsLintConfig({
    ignorePatterns,
    toolRoots = {},
    trees,
    units,
}: {
    ignorePatterns: readonly string[];
    toolRoots?: MemberToolRoots;
    trees: LintTrees;
    units: readonly string[];
}): string {
    const ls: Record<string, Rules> = {};
    for (const prefix of units) {
        const named = `${prefix}{${CODE_ROOTS.join(',')}}`;
        ls[named] = { '.dir': `regex:${CODE_DIRECTORY}` };
        ls[`${named}/**/app`] = ANY_NAME;
        ls[`${prefix}specs`] = { '.dir': `regex:${SPECS_DIRECTORY}` };
        const tree = trees[prefix];
        Object.assign(
            ls,
            tree === undefined ? {} : lintTreeRules(prefix, tree),
            skillRules(prefix),
        );
    }
    Object.assign(ls, toolRootRules(toolRoots));

    return `${JSON.stringify({ ignore: ignoredOf(ignorePatterns), ls }, null, 2)}\n`;
}

function failedOf(root: string, failures: Failures, swept: ReadonlySet<string>): Failed[] {
    const holdsSwept = (directory: string): boolean =>
        [...swept].some((file) => file.startsWith(`${directory}/`));

    return Object.entries(failures).flatMap(([path, rules]): Failed[] => {
        if (Object.hasOwn(rules, '.dir')) {
            return holdsSwept(path) ? [{ isDirectory: true, path }] : [];
        }
        const entries = listed(join(root, path));

        return (
            entries === null
                ? [{ isDirectory: false, path }]
                : entries.map((entry) => ({ isDirectory: false, path: `${path}/${entry.name}` }))
        ).filter((failed) => swept.has(failed.path));
    });
}

const CLOSED_PLACES = [
    /^lint\/[^/]+$/u,
    /^lint\/[^/]+\/[^/]+$/u,
    /^skills\/[^/]+$/u,
    /^skills\/[^/]+\/[^/]+$/u,
];

const isUnseenByLsLint = (name: string): boolean => name.startsWith('.') || !name.includes('.');

function unseenOf(units: readonly string[], swept: ReadonlySet<string>): Failed[] {
    return [...swept].flatMap((path): Failed[] => {
        const prefix =
            // Stryker disable next-line StringLiteral: the root unit, '', prefixes every path
            units
                .filter((unit) => path.startsWith(unit))
                .toSorted((left, right) => right.length - left.length)[0] ?? '';
        const own = path.slice(prefix.length);
        const closed =
            CLOSED_PLACES.some((place) => place.test(own)) && isUnseenByLsLint(basename(own));

        return closed ? [{ isDirectory: false, path }] : [];
    });
}

export function listed(directory: string): Dirent[] | null {
    try {
        return readdirSync(directory, { withFileTypes: true });
    } catch {
        return null;
    }
}

const isInside = (path: string, folders: readonly string[]): boolean =>
    folders.some((folder) => path.startsWith(`${folder}/`));

export function lsLintFindings(
    root: string,
    {
        failures,
        swept,
        trees,
        units,
    }: { failures: Failures; swept: readonly string[]; trees: LintTrees; units: readonly string[] },
): Finding[] {
    const held = new Set(swept);
    const failed = [...failedOf(root, failures, held), ...unseenOf(units, held)];
    const paths = failed.map(({ path }) => path);
    const reported = new Map<string, Finding>();
    // Stryker disable next-line EqualityOperator: two failures of one path name the same finding, whichever comes first
    for (const one of failed.toSorted((left, right) => (left.path < right.path ? -1 : 1))) {
        const finding = isInside(one.path, paths)
            ? undefined
            : placementFindingOf({ trees, units }, one);
        if (finding !== undefined) {
            reported.set(finding.path, finding);
        }
    }

    return [...reported.values()];
}

function failuresOf(parsed: unknown): Failures {
    return Object.fromEntries(
        Object.entries(objectOf(parsed)).map(([path, rules]) => [
            path,
            Object.fromEntries(
                Object.entries(objectOf(rules)).map(([key, failed]) => [
                    key,
                    [failed].flat().map(String),
                ]),
            ),
        ]),
    );
}

// invariant: a name is judged from its path alone, so ls-lint walks a tree of empty files laid out from the swept paths — a link a run left on the disk, under an ignored dot folder or elsewhere, is never entered; a manifest holds an empty object, since node, which runs the tool's launcher in the tree, refuses an empty one.
function stagePaths(scratch: string, paths: readonly string[]): string {
    const staged = join(scratch, 'tree');
    mkdirSync(staged);
    for (const path of paths) {
        mkdirSync(join(staged, dirname(path)), { recursive: true });
        writeFileSync(join(staged, path), basename(path) === 'package.json' ? '{}\n' : '');
    }

    return staged;
}

export function runLsLint(
    binary: string,
    config: string,
    paths: readonly string[],
): { failures: Failures; problem: null | string } {
    // Stryker disable next-line StringLiteral: the prefix only names the scratch folder for whoever finds it left behind
    const scratch = mkdtempSync(join(tmpdir(), 'typescript-ls-lint-'));
    try {
        const path = join(scratch, 'ls-lint.yml');
        writeFileSync(path, config);
        const staged = stagePaths(scratch, paths);
        const { output, ran, status } = runTool(
            'ls-lint',
            binary,
            ['-config', path, '-error-output-format', 'json'],
            staged,
        );
        if (status === 0) {
            return { failures: {}, problem: null };
        }
        try {
            return { failures: failuresOf(JSON.parse(output)), problem: null };
        } catch {
            return {
                failures: {},
                problem: ran
                    ? refusal({
                          fix: 'correct what ls-lint printed — an `--ignore-pattern` or a declared glob it cannot read, a directory it cannot enter — then run again',
                          found: `ls-lint stopped with no report — ${output.trim()}`,
                          read: 'docs/reference/quality-checks.md#the-names-tree-pass',
                          why: 'where a name sits is judged from the failures ls-lint reports, and with no report no name is judged',
                      })
                    : output.trim(),
            };
        }
    } finally {
        rmSync(scratch, { recursive: true });
    }
}
