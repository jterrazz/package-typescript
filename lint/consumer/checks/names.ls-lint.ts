import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import type { Dirent } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { refusal } from '../../kit/catalogue/lesson.js';
import type { Finding } from '../../kit/checker/pass.js';
import { runTool } from '../../kit/checker/tool-run.js';
import { GROUND_FOLDERS } from '../../kit/project/ground.js';
import { objectOf } from '../../kit/project/json.js';
import { LINT_ROOT, TOPS } from './names.lint-tree.js';
import type { LintTree, Top } from './names.lint-tree.js';
import { placementFindingOf } from './names.placement.js';
import type { Failed } from './names.placement.js';

type Rules = Record<string, string>;

export type Failures = Readonly<Record<string, Readonly<Record<string, readonly string[]>>>>;

const KEBAB = String.raw`_?[a-z0-9]+(-[a-z0-9]+)*`;

const FRAMEWORK_ROUTE_SEGMENT = String.raw`\[{1,2}(\.{3})?[A-Za-z0-9]+\]{1,2}|\([a-z0-9-]+\)|@[a-z0-9-]+`;

const DIRECTORY = `(?:${KEBAB}|${FRAMEWORK_ROUTE_SEGMENT})`;

const NAMED_ROOTS = ['apps', 'bin', 'lib', 'packages', 'specs', 'src', 'tests'];

const ROUTE_SEGMENT = 'regex:.+';

const IGNORED = [
    'node_modules',
    '**/node_modules',
    'dist',
    '**/.*',
    ...GROUND_FOLDERS.map((folder) => `**/${folder}`),
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
            '.dir': `regex:${KEBAB}`,
        };
    }

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
        [`${prefix}skills/*/*`]: { '.*': 'exists:0', '.dir': 'exists:0' },
    };
}

export function ignoredOf(ignorePatterns: readonly string[]): string[] {
    return [...IGNORED, ...ignorePatterns.map((pattern) => pattern.replace(/\/\*\*$/u, ''))];
}

export function lsLintConfig({
    ignorePatterns,
    tree,
    units,
}: {
    ignorePatterns: readonly string[];
    tree: LintTree;
    units: readonly string[];
}): string {
    const ls: Record<string, Rules> = {};
    for (const prefix of units) {
        const named = `${prefix}{${NAMED_ROOTS.join(',')}}`;
        ls[named] = { '.dir': `regex:${DIRECTORY}` };
        ls[`${named}/**/app`] = { '.dir': ROUTE_SEGMENT };
        Object.assign(ls, lintTreeRules(prefix, tree), skillRules(prefix));
    }

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
                : entries
                      .filter((entry) => entry.isFile())
                      .map((entry) => ({ isDirectory: false, path: `${path}/${entry.name}` }))
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
            units
                .filter((unit) => path.startsWith(unit))
                .toSorted((left, right) => right.length - left.length)[0] ?? '';
        const own = path.slice(prefix.length);
        const closed =
            CLOSED_PLACES.some((place) => place.test(own)) &&
            isUnseenByLsLint(own.split('/').at(-1) ?? '');

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

const isInside = (path: string, directories: readonly string[]): boolean =>
    directories.some((directory) => path.startsWith(`${directory}/`));

export function lsLintFindings(
    root: string,
    {
        failures,
        swept,
        tree,
        units,
    }: { failures: Failures; swept: readonly string[]; tree: LintTree; units: readonly string[] },
): Finding[] {
    const held = new Set(swept);
    const failed = [...failedOf(root, failures, held), ...unseenOf(units, held)];
    const directories = failed.filter(({ isDirectory }) => isDirectory).map(({ path }) => path);
    const reported = new Map<string, Finding>();
    for (const one of failed.toSorted((left, right) => (left.path < right.path ? -1 : 1))) {
        const finding = isInside(one.path, directories)
            ? undefined
            : placementFindingOf({ tree, units }, one);
        if (finding !== undefined && !reported.has(finding.path)) {
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
                    Array.isArray(failed) ? failed.map(String) : [],
                ]),
            ),
        ]),
    );
}

export function runLsLint(
    binary: string,
    root: string,
    config: string,
): { failures: Failures; problem: null | string } {
    const scratch = mkdtempSync(join(tmpdir(), 'typescript-ls-lint-'));
    try {
        const path = join(scratch, 'ls-lint.yml');
        writeFileSync(path, config);
        const { output, ran, status } = runTool(
            'ls-lint',
            binary,
            ['-config', path, '-error-output-format', 'json'],
            root,
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
                          read: 'docs/07-quality-checks.md#the-names-tree-pass',
                          why: 'where a name sits is judged from the failures ls-lint reports, and with no report no name is judged',
                      })
                    : output.trim(),
            };
        }
    } finally {
        rmSync(scratch, { force: true, recursive: true });
    }
}
