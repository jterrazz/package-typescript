import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import type { Dirent } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { refusal } from '../../engine/catalogue/lesson.js';
import type { Finding } from '../../engine/checker/pass.js';
import { runTool } from '../../engine/checker/tool-run.js';
import { GROUND_FOLDERS } from '../../engine/project/ground.js';
import { objectOf } from '../../engine/project/json.js';
import { LINT_ROOT, LINT_TREE } from './names.lint-tree.js';
import { placementFindingOf } from './names.placement.js';
import type { Failed } from './names.placement.js';

type Top = keyof typeof LINT_TREE;

type Rules = Record<string, string>;

type Failures = Readonly<Record<string, Readonly<Record<string, readonly string[]>>>>;

const KEBAB = String.raw`_?[a-z0-9]+(-[a-z0-9]+)*`;

const FRAMEWORK_ROUTE_SEGMENT = String.raw`\[{1,2}(\.{3})?[A-Za-z0-9]+\]{1,2}|\([a-z0-9-]+\)|@[a-z0-9-]+`;

const DIRECTORY = `${KEBAB}|${FRAMEWORK_ROUTE_SEGMENT}`;

const NAMED_ROOTS = ['apps', 'bin', 'lib', 'packages', 'specs', 'src', 'tests'];

const ROUTE_SEGMENT = 'regex:.+';

const IGNORED = [
    'node_modules',
    '**/node_modules',
    'dist',
    '**/.*',
    ...GROUND_FOLDERS.map((folder) => `**/${folder}`),
];

const ROOT_FILE: Readonly<Record<Top, string>> = Object.freeze({
    consumer: 'exists:0',
    engine: 'exists:0',
    self: 'regex:index',
});

const LINT_FOLDERS = Object.keys(LINT_TREE);

const isTop = (name: string): name is Top => Object.hasOwn(LINT_TREE, name);

function lintTreeRules(prefix: string): Record<string, Rules> {
    const lint = `${prefix}${LINT_ROOT}`;
    const rules: Record<string, Rules> = {
        [lint]: { '.*': 'regex:index', '.dir': `regex:${LINT_ROOT}` },
    };
    for (const top of LINT_FOLDERS.filter((name) => isTop(name))) {
        rules[`${lint}/${top}`] = { '.*': ROOT_FILE[top], '.dir': `regex:${top}` };
        rules[`${lint}/${top}/{${LINT_TREE[top].join(',')}}`] = {
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

export function lsLintConfig(units: readonly string[], ignorePatterns: readonly string[]): string {
    const ls: Record<string, Rules> = {};
    for (const prefix of units) {
        const named = `${prefix}{${NAMED_ROOTS.join(',')}}`;
        ls[named] = { '.dir': `regex:${DIRECTORY}` };
        ls[`${named}/**/app`] = { '.dir': ROUTE_SEGMENT };
        Object.assign(ls, lintTreeRules(prefix), skillRules(prefix));
    }
    const ignore = [
        ...IGNORED,
        ...ignorePatterns.map((pattern) => pattern.replace(/\/\*\*$/u, '')),
    ];

    return `${JSON.stringify({ ignore, ls }, null, 2)}\n`;
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

function listed(directory: string): Dirent[] | null {
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
        units,
    }: { failures: Failures; swept: readonly string[]; units: readonly string[] },
): Finding[] {
    const held = new Set(swept);
    const failed = [...failedOf(root, failures, held), ...unseenOf(units, held)];
    const directories = failed.filter(({ isDirectory }) => isDirectory).map(({ path }) => path);
    const reported = new Map<string, Finding>();
    for (const one of failed.toSorted((left, right) => (left.path < right.path ? -1 : 1))) {
        const finding = isInside(one.path, directories)
            ? undefined
            : placementFindingOf(units, one);
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
    { ignorePatterns, units }: { ignorePatterns: readonly string[]; units: readonly string[] },
): { failures: Failures; problem: null | string } {
    const scratch = mkdtempSync(join(tmpdir(), 'typescript-ls-lint-'));
    try {
        const config = join(scratch, 'ls-lint.yml');
        writeFileSync(config, lsLintConfig(units, ignorePatterns));
        const { output, ran, status } = runTool(
            'ls-lint',
            binary,
            ['-config', config, '-error-output-format', 'json'],
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
                          fix: 'correct what ls-lint printed — an `--ignore-pattern` it cannot read as a glob, a directory it cannot enter — then run again',
                          found: `ls-lint stopped with no report — ${output.trim()}`,
                          read: 'docs/06-quality-checks.md#the-names-tree-pass',
                          why: 'where a name sits is judged from the failures ls-lint reports, and with no report no name is judged',
                      })
                    : output.trim(),
            };
        }
    } finally {
        rmSync(scratch, { force: true, recursive: true });
    }
}
