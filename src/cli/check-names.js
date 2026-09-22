#!/usr/bin/env node

/**
 * What a project's own tree calls its parts.
 *
 * Three rosters, all closed, all here and nowhere else. A **grab-bag** name
 * says nothing about what it holds, so it holds whatever nobody placed:
 * `utils.ts` is what a folder called `utils/` grows out of, and the folder is
 * what a missing subject grows out of. A **construct** name says which part of
 * the language a file holds — its types, its constants — instead of which part
 * of the domain. A **shortcut** says it in half — each one the short form of a
 * word the tree spells out somewhere else, so two spellings of one idea end up
 * sitting side by side.
 *
 * The root's own folders are the SPINE, the same five in every repository:
 * `src/`, `lint/`, `specs/`, `docs/`, `skills/` — and `apps/` or `packages/`
 * where a workspace holds its members, each carrying a spine of its own. A
 * skill is one `skills/<skill>/SKILL.md` and nothing beside it. Beside the
 * spine a root stands only on a codified ground: a name the ecosystem imposes
 * (`ECOSYSTEM_ROOTS`), or one the repository declares in its `package.json`
 * under `jterrazz.typescript.roots`, each with its reason. Any other root is
 * refused.
 *
 * Usage: node check-names.js [root] [--ignore-pattern <glob>]… [--format json]
 *
 * One line per violation, `<rule>  <path>  <message>`. Every rule carries the
 * code `names(<rule>)`, which the ratchet records as `names/<rule>`: where
 * `typescript.baseline.json` holds a `names/*` entry, the counts are judged against
 * it the way the linter's are, and a held count prints nothing. `--format json`
 * is the report `typescript baseline` records from.
 *
 * Exit code: 0 when every name claims a subject or the ratchet holds, 1
 * otherwise. No `--fix`: renaming a file is a move, and choosing the name it
 * moves to is the work the rule is asking for.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { argv, exit, stdout } from 'node:process';

import { BASELINE, judge, readBaseline } from './check-baseline.js';
import { ignorePatternsOf, trackedFiles } from './tracked-files.js';

/** Names that say nothing: a folder or a file called one of these holds whatever nobody placed. */
const GRAB_BAG = new Set([
    'base',
    'common',
    'helpers',
    'lib',
    'misc',
    'shared',
    'stuff',
    'tools',
    'utils',
]);

/**
 * Names that say which construct of the language a file holds rather than
 * which subject of the domain. The words a grab-bag already refuses — `utils`,
 * `helpers`, `common`, `shared`, `misc`, `lib` — are that roster's, so a name
 * is reported once.
 */
const CONSTRUCTS = new Set(['constants', 'helper', 'interfaces', 'type', 'types', 'util']);

/** The construct a file names as a SUFFIX: `order.types.ts` is `types.ts` again. */
const CONSTRUCT_SUFFIX = 'types';

/**
 * Names that say it in half — each the short form of a word the tree writes out
 * somewhere. The `_` marker does not excuse one: it states a position, not
 * whether the name is whole. A name is read segment by segment, split on the
 * hyphen, so `explore-repo` is caught.
 */
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

/**
 * The roots the rule sweeps — where a project keeps what it wrote. Each root's
 * OWN name is the toolchain's vocabulary, not the project's choice, so it is
 * never judged: `lib/` is on both this list and the grab-bag roster, and only
 * what a project put INSIDE it is the project's to name.
 */
const SWEPT = new Set(['apps', 'bin', 'lib', 'lint', 'packages', 'specs', 'src', 'tests']);

/** The folders every repository root is made of. */
const SPINE = new Set(['docs', 'lint', 'skills', 'specs', 'src']);

/** Where a workspace root keeps its members, each one a spine of its own. */
const MEMBER_ROOTS = new Set(['apps', 'packages']);

/**
 * The roots a tool outside this package fixes by name: the repository does
 * not choose them, so it owes no declaration for them. Each maps to the tool
 * that imposes it.
 */
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

/**
 * Where a repository declares the roots it keeps beyond the spine:
 * `package.json`'s `jterrazz.typescript.roots` — the `jterrazz` key holds one
 * settings object per package of the family, and this package reads only its own.
 */
const DECLARATION = 'jterrazz.typescript.roots';

/** The one file a skill is: `skills/<skill>/SKILL.md`. */
const SKILL_FILE = /^skills\/[^/]+\/SKILL\.md$/u;

/**
 * A Next.js route segment is a URL: what a directory below `app/` is called is
 * the address the product serves, not a name the tree chose. The router root
 * itself is judged like any directory; what it contains is not.
 */
const ROUTER_ROOT = 'app';

/** A `_` opens a row — a fixture, a golden, a template — and a row is not a subject. */
const isOfTheRow = (name) => name.startsWith('_');

/** A directory claims its own segment. */
const isGrabBag = (name) => !isOfTheRow(name) && GRAB_BAG.has(name.toLowerCase());

/** A construct is a construct whatever marks its position. */
const isConstruct = (name) => CONSTRUCTS.has(name.replace(/^_/u, '').toLowerCase());

/** `order.types.ts`: a dotted segment between the stem and the extension. */
const hasConstructSuffix = (fileName) =>
    fileName.split('.').slice(1, -1).includes(CONSTRUCT_SUFFIX);

/** A name carries a truncation when any hyphen-separated segment of it is one. */
const isShortcut = (name) =>
    name
        .toLowerCase()
        .split('-')
        .some((segment) => SHORTCUTS.has(segment));

/** A file claims what stands before its first dot: `utils.ts` and `utils.test.ts` both claim `utils`. */
const stemOf = (name) => name.split('.')[0] ?? '';

/**
 * Every name a set of paths puts on the tree, each mapped to the path that
 * carries it: every directory below a swept root that is not a route, and
 * every file's stem. A file also carries its whole name, for the suffix a
 * stem cannot see.
 */
function namesOf(files) {
    const named = new Map();

    for (const file of files) {
        const segments = file.split('/');
        if (!SWEPT.has(segments[0]) || segments.length < 2) {
            continue;
        }

        /* From the second segment on: the root's own name is not the project's,
         * and below a router root a directory is a route. */
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

/** Every violation a tree's names carry, in path order. */
function findingsOf(files) {
    const findings = [];

    for (const [path, { fileName, name }] of namesOf(files)) {
        if (isGrabBag(name)) {
            findings.push({
                message: `\`${name}\` names no subject — it holds whatever nobody placed`,
                path,
                rule: 'names-grab-bag',
            });
        } else if (isConstruct(name) || (fileName !== undefined && hasConstructSuffix(fileName))) {
            findings.push({
                message: `\`${fileName ?? name}\` names a construct of the language — name it for the subject it holds`,
                path,
                rule: 'names-construct',
            });
        }
        if (isShortcut(name)) {
            findings.push({
                message: `\`${name}\` is a word written in half — spell it whole`,
                path,
                rule: 'names-shortcut',
            });
        }
    }

    return findings;
}

/**
 * The roots a repository declares beyond the spine, each with its reason, read
 * off `package.json`'s `jterrazz.typescript.roots` — `{ "<folder>": "<reason>" }`.
 * An absent key declares nothing, and a root declared anywhere else in the
 * manifest is not read.
 */
function declaredRootsOf(root) {
    const manifest = join(root, 'package.json');
    if (!existsSync(manifest)) {
        return {};
    }

    try {
        const roots = JSON.parse(readFileSync(manifest, 'utf8'))?.jterrazz?.typescript?.roots;

        return roots !== null && typeof roots === 'object' && !Array.isArray(roots) ? roots : {};
    } catch {
        return {};
    }
}

/** What the root's own folders owe the spine: a skill holds one file, and a root stands on a codified ground. */
function spineOf(files, declared) {
    const findings = [];
    const roots = new Set();

    for (const file of files) {
        const [first, ...rest] = file.split('/');
        if (rest.length === 0 || first.startsWith('.')) {
            continue;
        }
        roots.add(first);
        if (first === 'skills' && !SKILL_FILE.test(file)) {
            findings.push({
                message: `a skill is one \`skills/<skill>/SKILL.md\` — \`${file}\` sits beside it`,
                path: file,
                rule: 'names-skill-file',
            });
        }
    }

    const isCodified = (root) =>
        SPINE.has(root) ||
        MEMBER_ROOTS.has(root) ||
        Object.hasOwn(ECOSYSTEM_ROOTS, root) ||
        Object.hasOwn(declared, root);

    for (const root of [...roots].toSorted((left, right) => (left < right ? -1 : 1))) {
        if (!isCodified(root)) {
            findings.push({
                message: `\`${root}/\` is a root outside the spine — move it under src/, or declare it in package.json's \`${DECLARATION}\` with its reason`,
                path: `${root}/`,
                rule: 'names-root-foreign',
            });
        }
    }

    for (const [root, reason] of Object.entries(declared).toSorted(([left], [right]) =>
        left < right ? -1 : 1,
    )) {
        if (typeof reason !== 'string' || reason.trim() === '') {
            findings.push({
                message: `\`${root}/\` is declared in \`${DECLARATION}\` with no reason — say why the repository keeps it`,
                path: `${root}/`,
                rule: 'names-root-unreasoned',
            });
        } else if (!roots.has(root)) {
            findings.push({
                message: `\`${root}/\` is declared in \`${DECLARATION}\` and holds no tracked file — delete the entry`,
                path: `${root}/`,
                rule: 'names-root-stale',
            });
        }
    }

    return findings;
}

/** The namespace the pass's rules take in the ratchet's file. */
const NAMESPACE = 'names/';

/** A finding as the ratchet reads one: `names(<rule>)` becomes `names/<rule>`. */
const codeOf = (rule) => `names(${rule})`;

const root = resolve(argv.slice(2).find((argument) => !argument.startsWith('--')) ?? '.');
const files = trackedFiles(root, { ignorePatterns: ignorePatternsOf(argv) });
const findings = [...findingsOf(files), ...spineOf(files, declaredRootsOf(root))];

if (argv.includes('--format')) {
    const diagnostics = findings.map(({ message, path, rule }) => ({
        code: codeOf(rule),
        filename: path,
        message,
        severity: 'error',
    }));
    stdout.write(`${JSON.stringify({ diagnostics })}\n`);
    exit(0);
}

for (const { message, path, rule } of findings) {
    stdout.write(`${rule}  ${path}  ${message}\n`);
}

/*
 * Where the file records this pass's side, its counts are the verdict. Where
 * it records none — or there is no file — every finding is a failure, exactly
 * as before a ratchet existed.
 */
const recorded = Object.fromEntries(
    Object.entries(readBaseline(root) ?? {}).filter(([rule]) => rule.startsWith(NAMESPACE)),
);

if (Object.keys(recorded).length === 0) {
    exit(findings.length > 0 ? 1 : 0);
}

const counts = {};
for (const { rule } of findings) {
    counts[`${NAMESPACE}${rule}`] = (counts[`${NAMESPACE}${rule}`] ?? 0) + 1;
}

const broken = judge(counts, recorded);
for (const reason of broken) {
    stdout.write(`baseline-ratchet  ${BASELINE}  ${reason}\n`);
}
if (broken.length > 0) {
    stdout.write("Run 'typescript baseline' to record where the project actually stands.\n");
}

exit(broken.length > 0 ? 1 : 0);
