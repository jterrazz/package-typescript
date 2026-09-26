#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, matchesGlob, resolve } from 'node:path';
import { argv, exit, stdout } from 'node:process';

import { judge, LABEL, readBaseline, reRecord } from '../ratchet/baseline.js';
import { catalogueFamilies } from '../reading/catalogue-families.js';
import { emptyDirectories, removeEmptyDirectory } from '../reading/empty-directories.js';
import { readSection, SETTINGS_FILE } from '../reading/jterrazz-config.js';
import { ignorePatternsOf, orRefused, projectFiles } from '../reading/project-files.js';
import { isRepositoryRoot } from '../reading/repository-root.js';
import { workspaceMembers } from '../reading/workspace-members.js';

const GRAB_BAG = new Set(['base', 'common', 'helpers', 'lib', 'misc', 'stuff', 'tools', 'utils']);

// A word the grab-bag roster already refuses is left to it, so a name is reported once.
const CONSTRUCTS = new Set(['constants', 'helper', 'interfaces', 'type', 'types', 'util']);

const CONSTRUCT_SUFFIX = 'types';

// A name is read segment by segment, split on the hyphen; the `_` marker excuses none.
const SHORTCUTS = new Set([
    'auth',
    'cfg',
    'impl',
    'infra',
    'k8s',
    'pkg',
    'repo',
    'repos',
    'svc',
    'tmp',
]);

// A swept root's own name is the toolchain's, never judged: `lib/` is also a grab-bag word.
const SWEPT = new Set(['apps', 'bin', 'lib', 'lint', 'packages', 'specs', 'src', 'tests']);

const SPINE = new Set(['docs', 'lint', 'skills', 'specs', 'src']);

const MEMBER_ROOTS = new Set(['apps', 'packages']);

const ECOSYSTEM_ROOTS = Object.freeze({
    android: 'React Native and Expo — the native Android project',
    app: 'Next.js App Router and Expo Router — routes are read off this folder',
    bin: "npm — the files a package's `bin` entry links as commands",
    config: "node-config — the default folder its `require('config')` reads",
    ios: 'React Native and Expo — the native iOS project',
    pages: 'Next.js Pages Router — routes are read off this folder',
    prisma: 'Prisma — the schema and migrations its CLI reads by default',
    public: 'Next.js, Astro and Vite — static files served verbatim at the site root',
});

const DECLARATION = 'typescript.roots';

// The only gestures the flows speak; a workspace member owes none of them.
const MAKE_TARGETS = Object.freeze(['install', 'build', 'lint', 'fix', 'test', 'check']);

const MAKEFILE = 'Makefile';

// A recipe line opens on a tab and never matches; `:=` and `::=` open assignments.
const RULE_LINE = /^(?<targets>[^\s:#=][^:#=]*?)\s*(?:::|:)(?![:=])/u;

const SKILL_FILE = /^skills\/[^/]+\/SKILL\.md$/u;

// Below `app/`, a Next.js directory is a URL the product serves, not a name the tree chose.
const ROUTER_ROOT = 'app';

// A `_` prefix marks a row — a fixture, a golden, a template — and a row is not a subject.
const isOfTheRow = (name) => name.startsWith('_');

const isGrabBag = (name) => !isOfTheRow(name) && GRAB_BAG.has(name.toLowerCase());

const isConstruct = (name) => CONSTRUCTS.has(name.replace(/^_/u, '').toLowerCase());

const hasConstructSuffix = (fileName) =>
    fileName.split('.').slice(1, -1).includes(CONSTRUCT_SUFFIX);

const isShortcut = (name) =>
    name
        .toLowerCase()
        .split('-')
        .some((segment) => SHORTCUTS.has(segment));

const stemOf = (name) => name.split('.')[0] ?? '';

function namesOf(files) {
    const named = new Map();

    for (const file of files) {
        const segments = file.split('/');
        if (!SWEPT.has(segments[0]) || segments.length < 2) {
            continue;
        }

        const routerRoot = segments.indexOf(ROUTER_ROOT, 1);
        const lastJudged = routerRoot === -1 ? segments.length - 1 : routerRoot + 1;
        for (let index = 1; index < Math.min(lastJudged, segments.length - 1); index += 1) {
            const path = segments.slice(0, index + 1).join('/');
            named.set(path, { name: segments[index] });
        }
        named.set(file, { fileName: segments.at(-1), name: stemOf(segments.at(-1)) });
    }

    return [...named].toSorted(([left], [right]) => (left < right ? -1 : 1));
}

function findingsOf(files) {
    const findings = [];

    for (const [path, { fileName, name }] of namesOf(files)) {
        if (isGrabBag(name)) {
            findings.push({
                message: `\`${name}\` names no subject — it holds whatever nobody placed`,
                path,
                rule: 'names/no-grab-bag-name',
            });
        } else if (isConstruct(name) || (fileName !== undefined && hasConstructSuffix(fileName))) {
            findings.push({
                message: `\`${fileName ?? name}\` names a construct of the language — name it for the subject it holds`,
                path,
                rule: 'names/no-language-construct-name',
            });
        }
        if (isShortcut(name)) {
            findings.push({
                message: `\`${name}\` is a word written in half — spell it whole`,
                path,
                rule: 'names/no-abbreviated-word',
            });
        }
    }

    return findings;
}

function manifestOf(unit) {
    const manifest = join(unit, 'package.json');
    if (!existsSync(manifest)) {
        return {};
    }

    try {
        const parsed = JSON.parse(readFileSync(manifest, 'utf8'));

        return parsed !== null && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

async function settingsOf(unit) {
    const { problem, section } = await readSection(unit, 'typescript');
    if (problem !== null) {
        return { problem, roots: {} };
    }

    const { roots } = section;
    if (roots === undefined) {
        return { problem: null, roots: {} };
    }
    if (roots === null || typeof roots !== 'object' || Array.isArray(roots)) {
        return {
            problem: `holds a \`${DECLARATION}\` that is not an object mapping each folder to its reason`,
            roots: {},
        };
    }

    return { problem: null, roots };
}

function targetsOfExports(exports) {
    if (typeof exports === 'string') {
        return [exports];
    }
    if (exports === null || typeof exports !== 'object') {
        return [];
    }

    return Object.values(exports).flatMap((value) => targetsOfExports(value));
}

// `lint/` is the one spine folder kept on a condition: that the unit ships it.
const LINT_ROOT = 'lint';

// tsdown's own lookup order.
const BUILD_CONFIGS = [
    'tsdown.config.ts',
    'tsdown.config.mts',
    'tsdown.config.cts',
    'tsdown.config.js',
    'tsdown.config.mjs',
    'tsdown.config.cjs',
];

const DEFAULT_OUT_DIR = 'dist';

const LINT_ENTRY =
    /(?:(?:(?<quoted>['"])(?<quotedKey>[^'"]+)\k<quoted>|(?<key>[\w$-]+))\s*:\s*)?['"](?:\.\/)?(?<source>lint\/[^'"]+)['"]/gu;

const ENTRY_KEYS = new Set(['entry', 'input']);

const withoutDotSlash = (path) => path.replace(/^\.\//u, '');

// The config is a module a bundler loads, so it is read, never run.
function lintOutputsOf(unit) {
    const config = BUILD_CONFIGS.find((name) => existsSync(join(unit, name)));
    if (config === undefined) {
        return [];
    }

    const text = readFileSync(join(unit, config), 'utf8');
    const outDir = withoutDotSlash(
        /outDir\s*:\s*['"](?<dir>[^'"]+)['"]/u.exec(text)?.groups.dir ?? DEFAULT_OUT_DIR,
    );

    return [...text.matchAll(LINT_ENTRY)].map(({ groups }) => {
        const key = groups.quotedKey ?? groups.key;
        const name =
            key === undefined || ENTRY_KEYS.has(key)
                ? basename(groups.source).replace(/\.[^.]+$/u, '')
                : key;

        return `${outDir.replace(/\/$/u, '')}/${name}`;
    });
}

function filesPublish(files, path) {
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

// A `lint/` nothing publishes holds rules no consumer receives: `src/` under another name.
function shipsLint(manifest, unit) {
    const files = Array.isArray(manifest.files) ? manifest.files : [];
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
    const byBuild = lintOutputsOf(unit).some(
        (output) =>
            targets.some((target) => target.startsWith(`${output}.`)) ||
            filesPublish(files, `${output}.js`),
    );

    return byFiles || byExports || byBuild;
}

function foreignRoot(root, prefix) {
    const manifestPath = `${prefix}package.json`;

    return {
        message:
            root === LINT_ROOT
                ? `\`${prefix}lint/\` holds the lint rules a package ships, and neither ${manifestPath} nor its build publishes it — ship it, or move it under src/`
                : `\`${prefix}${root}/\` is a root outside the spine — move it under src/, or declare it in ${prefix}${SETTINGS_FILE}'s \`${DECLARATION}\` with its reason`,
        path: `${prefix}${root}/`,
        rule: 'names/no-undeclared-root-folder',
    };
}

function declarationOf(declared, roots, prefix) {
    const findings = [];

    for (const [root, reason] of Object.entries(declared).toSorted(([left], [right]) =>
        left < right ? -1 : 1,
    )) {
        if (typeof reason !== 'string' || reason.trim() === '') {
            findings.push({
                message: `\`${prefix}${root}/\` is declared in ${prefix}${SETTINGS_FILE}'s \`${DECLARATION}\` with no reason — say why the repository keeps it`,
                path: `${prefix}${root}/`,
                rule: 'names/declared-root-states-its-reason',
            });
        } else if (!roots.has(root)) {
            findings.push({
                message: `\`${prefix}${root}/\` is declared in ${prefix}${SETTINGS_FILE}'s \`${DECLARATION}\` and holds no file — delete the entry`,
                path: `${prefix}${root}/`,
                rule: 'names/declared-root-holds-files',
            });
        }
    }

    return findings;
}

const LINT_FOLDERS = Object.freeze([
    'catalogue',
    'rulebook',
    'rules',
    'checks',
    'ratchet',
    'reading',
    'self',
    'migration',
]);

const LINT_TREE_READ = 'read: docs/06-quality-checks.md#the-lint-tree';

function lintRootFinding(path) {
    return {
        message: [
            `found: \`${path}\` sits at the root of lint/`,
            'why: lint/ has one tree in every repository — its root holds the entry the package ships, `index`, and a folder names the nature of every other file',
            `fix: move it into the folder its nature names — ${LINT_FOLDERS.join(', ')} — or into docs/ if it explains`,
            LINT_TREE_READ,
        ].join(' · '),
        path,
        rule: 'names/lint-root-holds-only-index',
    };
}

function lintFolderFinding(path) {
    return {
        message: [
            `found: \`${path}\` is not a folder of the lint tree`,
            `why: lint/ has one tree in every repository, so its folders are the eight that name a nature — ${LINT_FOLDERS.join(', ')}`,
            'fix: move its files where their nature puts them — a decision on an upstream rule under rulebook/, a rule of our own under rules/<family>/, a pass under checks/, a reader they share under reading/',
            LINT_TREE_READ,
        ].join(' · '),
        path,
        rule: 'names/lint-folder-is-known',
    };
}

function ruleFamilyFinding(path, folder, family) {
    return {
        message: [
            `found: \`${path}\` sits under \`rules/${folder}/\`, and its catalogue row gives it the family \`${family}\``,
            'why: a rule file sits under the folder of its family, so the tree and the catalogue say one thing',
            `fix: move it to \`rules/${family}/\`, or correct the family its catalogue row declares`,
            LINT_TREE_READ,
        ].join(' · '),
        path,
        rule: 'names/rule-file-in-its-family-folder',
    };
}

function lintTreeOf(files, unit, prefix) {
    const lintFiles = files.filter((file) => file.startsWith(`${LINT_ROOT}/`));
    const families = catalogueFamilies(unit, lintFiles);
    const findings = [];
    const foreign = new Set();

    for (const file of lintFiles) {
        const [, top, folder, ...rest] = file.split('/');
        if (folder === undefined) {
            if (stemOf(top) !== 'index') {
                findings.push(lintRootFinding(`${prefix}${file}`));
            }
        } else if (!LINT_FOLDERS.includes(top)) {
            foreign.add(top);
        } else if (top === 'rules' && rest.length > 0) {
            const family = families.get(stemOf(file.split('/').at(-1)));
            if (family !== undefined && family !== folder) {
                findings.push(ruleFamilyFinding(`${prefix}${file}`, folder, family));
            }
        }
    }

    return [
        ...findings,
        ...[...foreign]
            .toSorted((left, right) => (left < right ? -1 : 1))
            .map((top) => lintFolderFinding(`${prefix}${LINT_ROOT}/${top}/`)),
    ];
}

function spineOf(files, unit, settings, prefix = '') {
    const manifest = manifestOf(unit);
    const findings = [];
    const roots = new Set();
    const declared = settings.roots;
    if (settings.problem !== null) {
        findings.push({
            message: `\`${prefix}${SETTINGS_FILE}\` ${settings.problem}`,
            path: `${prefix}${SETTINGS_FILE}`,
            rule: 'names/jterrazz-config-loads',
        });
    }

    for (const file of files) {
        const [first, ...rest] = file.split('/');
        if (rest.length === 0 || first.startsWith('.')) {
            continue;
        }
        roots.add(first);
        if (first === 'skills' && !SKILL_FILE.test(file)) {
            findings.push({
                message: `a skill is one \`skills/<skill>/SKILL.md\` — \`${prefix}${file}\` sits beside it`,
                path: `${prefix}${file}`,
                rule: 'names/skill-holds-only-skill-md',
            });
        }
    }

    const isCodified = (root) =>
        (SPINE.has(root) && (root !== LINT_ROOT || shipsLint(manifest, unit))) ||
        MEMBER_ROOTS.has(root) ||
        Object.hasOwn(ECOSYSTEM_ROOTS, root) ||
        Object.hasOwn(declared, root);

    return [
        ...findings,
        ...lintTreeOf(files, unit, prefix),
        ...[...roots]
            .toSorted((left, right) => (left < right ? -1 : 1))
            .filter((root) => !isCodified(root))
            .map((root) => foreignRoot(root, prefix)),
        ...declarationOf(declared, roots, prefix),
    ];
}

async function spinesOf(root, files) {
    const members = workspaceMembers(root);
    const memberOf = (file) => members.find((member) => file.startsWith(`${member}/`));
    const memberSettings = await Promise.all(
        members.map(async (member) => await settingsOf(join(root, member))),
    );

    return [
        ...spineOf(
            files.filter((file) => memberOf(file) === undefined),
            root,
            await settingsOf(root),
        ),
        ...members.flatMap((member, index) =>
            spineOf(
                files
                    .filter((file) => file.startsWith(`${member}/`))
                    .map((file) => file.slice(member.length + 1)),
                join(root, member),
                memberSettings[index],
                `${member}/`,
            ),
        ),
    ];
}

function targetsOf(text) {
    const targets = new Set();
    for (const line of text.split('\n')) {
        const match = RULE_LINE.exec(line);
        for (const target of match?.groups.targets.split(/\s+/u) ?? []) {
            targets.add(target);
        }
    }

    return targets;
}

// Asked only where a `.git` stands beside the root, so a member, a fixture or a bare directory is never asked.
function makefileOf(root, files) {
    if (!isRepositoryRoot(root)) {
        return [];
    }
    const gestures = `${MAKE_TARGETS.slice(0, -1).join(', ')} and ${MAKE_TARGETS.at(-1)}`;
    if (!files.includes(MAKEFILE)) {
        return [
            {
                message: `the repository has no Makefile — every repository answers \`make\` ${gestures}`,
                path: MAKEFILE,
                rule: 'names/repository-has-makefile',
            },
        ];
    }

    const targets = targetsOf(readFileSync(join(root, MAKEFILE), 'utf8'));

    return MAKE_TARGETS.filter((target) => !targets.has(target)).map((target) => ({
        message: `\`make ${target}\` has no rule — every repository answers \`make\` ${gestures}`,
        path: MAKEFILE,
        rule: 'names/makefile-answers-every-gesture',
    }));
}

function emptyDirectoryFinding(path) {
    return {
        message: [
            `found: \`${path}/\` holds no file`,
            'why: git tracks no directory, so an empty one exists only on this machine and names a part of the tree that is not there',
            `fix: delete it — \`typescript fix\` does — or put the file it was made for in it`,
            'read: docs/06-quality-checks.md#an-empty-directory',
        ].join(' · '),
        path: `${path}/`,
        rule: 'names/no-empty-directory',
    };
}

const NAMESPACE = 'names/';

const codeOf = (rule) => `names(${rule.slice(NAMESPACE.length)})`;

const VALUED_FLAGS = new Set(['--format', '--ignore-pattern', '--report']);

const flagValue = (flag) => {
    const index = argv.indexOf(flag);

    return index === -1 ? undefined : argv[index + 1];
};

const root = resolve(
    argv
        .slice(2)
        .find(
            (argument, index, rest) =>
                !argument.startsWith('--') && !VALUED_FLAGS.has(rest[index - 1] ?? ''),
        ) ?? '.',
);
const ignorePatterns = ignorePatternsOf(argv);
const files = orRefused(() => projectFiles(root, { ignorePatterns }));

if (argv.includes('--fix')) {
    for (const path of emptyDirectories(root, { ignorePatterns })) {
        if (removeEmptyDirectory(root, path)) {
            stdout.write(`removed  ${path}/  an empty directory\n`);
        }
    }
}

const findings = [
    ...findingsOf(files),
    ...(await spinesOf(root, files)),
    ...makefileOf(root, files),
    ...emptyDirectories(root, { ignorePatterns }).map((path) => emptyDirectoryFinding(path)),
];

const report = () =>
    `${JSON.stringify({
        diagnostics: findings.map(({ message, path, rule }) => ({
            code: codeOf(rule),
            filename: path,
            message,
            severity: 'error',
        })),
    })}\n`;

if (argv.includes('--format')) {
    stdout.write(report());
    exit(0);
}

const reportPath = flagValue('--report');
if (reportPath !== undefined) {
    writeFileSync(reportPath, report());
}

for (const { message, path, rule } of findings) {
    stdout.write(`${rule}  ${path}  ${message}\n`);
}

// Where the baseline records no `names/*` entry, every finding is a failure.
const ownedOf = (section) =>
    Object.fromEntries(Object.entries(section).filter(([rule]) => rule.startsWith(NAMESPACE)));

let recorded = ownedOf(readBaseline(root) ?? {});

if (Object.keys(recorded).length === 0) {
    exit(findings.length > 0 ? 1 : 0);
}

const counts = {};
for (const { rule } of findings) {
    counts[rule] = (counts[rule] ?? 0) + 1;
}

if (argv.includes('--fix')) {
    const { lines, section } = reRecord(root, counts, (rule) => rule.startsWith(NAMESPACE));
    for (const line of lines) {
        stdout.write(`${line}\n`);
    }
    recorded = ownedOf(section);
}

const broken = judge(counts, recorded);
for (const reason of broken) {
    stdout.write(`baseline-ratchet  ${LABEL}  ${reason}\n`);
}
if (broken.length > 0) {
    stdout.write("Run 'typescript baseline' to record where the project actually stands.\n");
}

exit(broken.length > 0 ? 1 : 0);
