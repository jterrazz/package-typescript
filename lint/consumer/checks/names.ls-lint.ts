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

const HOLDS: Readonly<Record<Top, string>> = Object.freeze({
    consumer:
        'the declarations every consumer is held to — the catalogue, the rulebook of upstream decisions, our own rules by family, the checks',
    engine: 'what runs the declarations and knows none of them — how a project is read, the baseline, the checker, the catalogue rendered, the compiler of a rulebook into a config, the test tooling',
    self: 'the declarations only this repository is held to — its catalogue, its rules by family, its checks, the meta-tests of its corpus',
});

const FOLDER_RULES: Readonly<Record<Top, string>> = Object.freeze({
    consumer: 'names/consumer-folder-is-known',
    engine: 'names/engine-folder-is-known',
    self: 'names/self-folder-is-known',
});

const LINT_READ = 'read: docs/06-quality-checks.md#the-lint-tree';

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
        [`${prefix}skills/*`]: { '.*': 'regex:SKILL', '.dir': `regex:${KEBAB}` },
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

function lintFinding(path: string, rule: string, parts: readonly string[]): Finding {
    return { message: [...parts, LINT_READ].join(' · '), path, rule };
}

function audienceFinding(prefix: string, top: Top, found: string, rest: string): Finding {
    const folders = LINT_TREE[top];

    return lintFinding(`${prefix}${LINT_ROOT}/${top}/${rest}`, FOLDER_RULES[top], [
        `found: ${found}`,
        `why: ${top}/ holds ${HOLDS[top]}, so its folders are ${folders.join(', ')}${top === 'self' ? ', beside the `index` that composes them with engine/' : ''}`,
        `fix: move ${rest === '' ? 'the file' : 'its files'} into the folder its nature names — ${folders.map((folder) => `${folder}/`).join(', ')}`,
    ]);
}

function lintTreeFinding(prefix: string, path: string, isDirectory: boolean): Finding | undefined {
    const [top = '', folder, ...deeper] = path.split('/');
    if (!isDirectory && folder === undefined) {
        return lintFinding(`${prefix}${LINT_ROOT}/${top}`, 'names/lint-root-holds-only-index', [
            `found: \`${prefix}${LINT_ROOT}/${top}\` sits at the root of lint/`,
            'why: lint/ has one tree in every repository — its root holds `index`, the entry that composes consumer/ with engine/, and a folder names the audience of every other file',
            `fix: move it into the folder its audience names — ${LINT_FOLDERS.join(', ')} — or into docs/ if it explains`,
        ]);
    }
    if (!isTop(top)) {
        return lintFinding(`${prefix}${LINT_ROOT}/${top}/`, 'names/lint-folder-is-known', [
            `found: \`${prefix}${LINT_ROOT}/${top}/\` is not a folder of the lint tree`,
            `why: lint/ has one tree in every repository, split by audience — ${LINT_FOLDERS.join(', ')}`,
            'fix: move its files where their audience puts them — a declaration every consumer is held to under consumer/, one only this repository is held to under self/, what runs them under engine/',
        ]);
    }
    if (folder === undefined || (!isDirectory && deeper.length === 0)) {
        const file = folder ?? '';

        return audienceFinding(
            prefix,
            top,
            `\`${prefix}${LINT_ROOT}/${top}/${file}\` holds a file at the root of ${top}/`,
            file,
        );
    }

    return deeper.length === 0
        ? audienceFinding(
              prefix,
              top,
              `\`${prefix}${LINT_ROOT}/${top}/${folder}/\` is not a folder of ${top}/`,
              `${folder}/`,
          )
        : undefined;
}

function skillFinding(path: string): Finding {
    return {
        message: [
            `found: \`${path}\` sits beside a skill's \`SKILL.md\``,
            'why: a skill is one `skills/<skill>/SKILL.md`, the one page an agent loads, and a file beside it is one no agent reads',
            'fix: fold what it says into the `SKILL.md` or into the chapter the skill routes to, and delete it',
            'read: docs/06-quality-checks.md#the-names-tree-pass',
        ].join(' · '),
        path,
        rule: 'names/skill-holds-only-skill-md',
    };
}

function directoryFinding(path: string): Finding {
    return {
        message: [
            `found: \`${path}\` is not written in kebab-case`,
            'why: a directory name is part of every path and import that crosses it, and one case for every name reads the same on a disk that folds case and on one that does not',
            'fix: rename it in lowercase words joined by `-` — a leading `_` marks a folder the toolchain owns, and a route segment keeps its framework grammar (`[id]`, `(group)`, `@slot`)',
            'read: docs/06-quality-checks.md#the-names-tree-pass',
        ].join(' · '),
        path,
        rule: 'names/directory-in-kebab-case',
    };
}

type Failed = { isDirectory: boolean; path: string };

function findingOf(units: readonly string[], { isDirectory, path }: Failed): Finding | undefined {
    const prefix =
        units
            .filter((unit) => path.startsWith(unit))
            .toSorted((left, right) => right.length - left.length)[0] ?? '';
    const own = path.slice(prefix.length);
    if (own.startsWith(`${LINT_ROOT}/`)) {
        return lintTreeFinding(prefix, own.slice(LINT_ROOT.length + 1), isDirectory);
    }
    if (own.startsWith('skills/')) {
        return skillFinding(isDirectory ? `${path}/` : path);
    }

    return isDirectory ? directoryFinding(`${path}/`) : undefined;
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
        const finding = isInside(one.path, directories) ? undefined : findingOf(units, one);
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
