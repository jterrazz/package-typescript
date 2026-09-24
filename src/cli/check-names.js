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
 * `src/`, `lint/`, `specs/`, `docs/`, `skills/` — `lint/` only where the
 * package ships it — and `apps/` or `packages/` where a workspace holds its
 * members, each carrying a spine of its own, judged the same way. A
 * skill is one `skills/<skill>/SKILL.md` and nothing beside it. Beside the
 * spine a root stands only on a codified ground: a name the ecosystem imposes
 * (`ECOSYSTEM_ROOTS`), or one the unit — the repository, or the member —
 * declares in its own `jterrazz.config.ts` under `typescript.roots`, each
 * with its reason. Any other root is refused, and a settings file that does
 * not load is refused too. A repository's root also carries a `Makefile` answering
 * `install`, `build`, `lint`, `fix`, `test` and `check` — the gestures the
 * flows speak.
 *
 * Usage: node check-names.js [root] [--fix] [--ignore-pattern <glob>]…
 *                             [--format json] [--report <path>]
 *
 * One line per violation, `<rule>  <path>  <message>`. Every rule carries the
 * code `names(<rule>)`, which the ratchet records as `names/<rule>`: where
 * `jterrazz.baseline.json › typescript` holds a `names/*` entry, the counts are judged against
 * it the way the linter's are, and a held count prints nothing. `--format json`
 * is the report `typescript baseline` records from; `--report <path>` writes
 * that same report to a file beside the human run, for the line `check` prints
 * about the whole ratchet section.
 *
 * The tree's shape is judged on the disk as well: an empty directory git does
 * not ignore is a finding, since git tracks no directory and one exists only
 * on the machine that holds it.
 *
 * Exit code: 0 when every name claims a subject or the ratchet holds, 1
 * otherwise. `--fix` deletes the empty directories first, printing each one,
 * re-records every `names/*` entry whose count fell — lowered, or dropped at
 * zero, never raised — and judges the tree that is left. It renames nothing:
 * a rename is a move, and choosing the name it moves to is the work the rule
 * is asking for.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, matchesGlob, resolve } from 'node:path';
import { argv, exit, stdout } from 'node:process';

import { judge, LABEL, readBaseline, reRecord } from './check-baseline.js';
import { emptyDirectories, removeEmptyDirectory } from './empty-directories.js';
import { readSection, SETTINGS_FILE } from './jterrazz-config.js';
import { ignorePatternsOf, orRefused, projectFiles } from './project-files.js';
import { isRepositoryRoot } from './repository-root.js';
import { workspaceMembers } from './workspace-members.js';

/** Names that say nothing: a folder or a file called one of these holds whatever nobody placed. */
const GRAB_BAG = new Set(['base', 'common', 'helpers', 'lib', 'misc', 'stuff', 'tools', 'utils']);

/**
 * Names that say which construct of the language a file holds rather than
 * which subject of the domain. The words a grab-bag already refuses — `utils`,
 * `helpers`, `common`, `misc`, `lib` — are that roster's, so a name is
 * reported once.
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
 * Where a unit declares the roots it keeps beyond the spine: the `roots` of
 * its settings file's `typescript` section — the file holds one section per
 * package of the family, and this package reads only its own.
 */
const DECLARATION = 'typescript.roots';

/**
 * The gestures every repository answers at its root, and the only ones the
 * flows speak: `make <target>` is the same verb whatever the language under
 * it. A workspace member owes none of them — the repository does.
 */
const MAKE_TARGETS = Object.freeze(['install', 'build', 'lint', 'fix', 'test', 'check']);

/** The file those gestures live in, at the repository root. */
const MAKEFILE = 'Makefile';

/**
 * A rule line: targets before a `:` or `::` that does not open an assignment
 * (`:=`, `::=`). A recipe line opens on a tab and never matches.
 */
const RULE_LINE = /^(?<targets>[^\s:#=][^:#=]*?)\s*(?:::|:)(?![:=])/u;

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

/** A unit's parsed `package.json`, or an empty object where there is none to read. */
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

/**
 * What a unit's settings file declares for this package — its roots beyond
 * the spine, `{ "<folder>": "<reason>" }` — and the one sentence that says why
 * the file could not be read, or null. An absent file or key declares nothing.
 */
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

/** Every string an `exports` map points at, however deeply its conditions nest. */
function targetsOfExports(exports) {
    if (typeof exports === 'string') {
        return [exports];
    }
    if (exports === null || typeof exports !== 'object') {
        return [];
    }

    return Object.values(exports).flatMap((value) => targetsOfExports(value));
}

/** The one spine folder a unit keeps on a condition: the lint rules it SHIPS. */
const LINT_ROOT = 'lint';

/** The build configs a unit may keep beside its manifest, in the order tsdown looks. */
const BUILD_CONFIGS = [
    'tsdown.config.ts',
    'tsdown.config.mts',
    'tsdown.config.cts',
    'tsdown.config.js',
    'tsdown.config.mjs',
    'tsdown.config.cjs',
];

/** Where a build writes when its config names no `outDir`. */
const DEFAULT_OUT_DIR = 'dist';

/** A build entry's source under `lint/`, keyed or bare: `oxlint: 'lint/plugin.ts'`, `'lint/cli.ts'`. */
const LINT_ENTRY =
    /(?:(?:(?<quoted>['"])(?<quotedKey>[^'"]+)\k<quoted>|(?<key>[\w$-]+))\s*:\s*)?['"](?:\.\/)?(?<source>lint\/[^'"]+)['"]/gu;

/** The config keys that hold entries rather than name one. */
const ENTRY_KEYS = new Set(['entry', 'input']);

/** The path a manifest field names, without the leading `./`. */
const plain = (path) => path.replace(/^\.\//u, '');

/**
 * The outputs a unit's build compiles from `lint/`, as `<outDir>/<name>` —
 * read off the build config's text: a keyed entry is named for its key, a
 * bare one for its file. The config is a module a bundler loads, so it is
 * read, never run.
 */
function lintOutputsOf(unit) {
    const config = BUILD_CONFIGS.find((name) => existsSync(join(unit, name)));
    if (config === undefined) {
        return [];
    }

    const text = readFileSync(join(unit, config), 'utf8');
    const outDir = plain(
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

/** Whether a `files` list publishes `path`: the last entry that matches it decides, a `!` excluding. */
function filesPublish(files, path) {
    let published = false;
    for (const entry of files) {
        if (typeof entry !== 'string') {
            continue;
        }
        const excludes = entry.startsWith('!');
        const pattern = plain(excludes ? entry.slice(1) : entry).replace(/\/$/u, '');
        if (path === pattern || path.startsWith(`${pattern}/`) || matchesGlob(path, pattern)) {
            published = !excludes;
        }
    }

    return published;
}

/**
 * Whether a unit ships its `lint/`. Directly — a `files` entry or an
 * `exports` target reaches into it — or through its build: an entry of its
 * bundler config compiles a `lint/` source, and what it compiles to is
 * published, by an `exports`, `bin` or `main` target or by `files`. A
 * `lint/` nothing publishes holds rules no consumer receives, which is
 * `src/` under another name.
 */
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
    ].map((target) => plain(target));
    const byExports = targets.some((target) => /^lint(?:\/|$)/u.test(target));
    const byBuild = lintOutputsOf(unit).some(
        (output) =>
            targets.some((target) => target.startsWith(`${output}.`)) ||
            filesPublish(files, `${output}.js`),
    );

    return byFiles || byExports || byBuild;
}

/** Where a root stands outside the spine, said in the words that name its remedy. */
function foreignRoot(root, prefix) {
    const manifestPath = `${prefix}package.json`;

    return {
        message:
            root === LINT_ROOT
                ? `\`${prefix}lint/\` holds the lint rules a package ships, and neither ${manifestPath} nor its build publishes it — ship it, or move it under src/`
                : `\`${prefix}${root}/\` is a root outside the spine — move it under src/, or declare it in ${prefix}${SETTINGS_FILE}'s \`${DECLARATION}\` with its reason`,
        path: `${prefix}${root}/`,
        rule: 'names-root-foreign',
    };
}

/** What a unit's declaration owes: a reason per root, and a root that still holds a file. */
function declarationOf(declared, roots, prefix) {
    const findings = [];

    for (const [root, reason] of Object.entries(declared).toSorted(([left], [right]) =>
        left < right ? -1 : 1,
    )) {
        if (typeof reason !== 'string' || reason.trim() === '') {
            findings.push({
                message: `\`${prefix}${root}/\` is declared in ${prefix}${SETTINGS_FILE}'s \`${DECLARATION}\` with no reason — say why the repository keeps it`,
                path: `${prefix}${root}/`,
                rule: 'names-root-unreasoned',
            });
        } else if (!roots.has(root)) {
            findings.push({
                message: `\`${prefix}${root}/\` is declared in ${prefix}${SETTINGS_FILE}'s \`${DECLARATION}\` and holds no file — delete the entry`,
                path: `${prefix}${root}/`,
                rule: 'names-root-stale',
            });
        }
    }

    return findings;
}

/**
 * What one unit's own folders owe the spine: a skill holds one file, and a
 * root stands on a codified ground. `files` are relative to the unit; the
 * findings are named from the repository root, through `prefix`, and send the
 * reader to the unit's own `package.json` and settings file.
 */
function spineOf(files, unit, settings, prefix = '') {
    const manifest = manifestOf(unit);
    const findings = [];
    const roots = new Set();
    const declared = settings.roots;
    if (settings.problem !== null) {
        findings.push({
            message: `\`${prefix}${SETTINGS_FILE}\` ${settings.problem}`,
            path: `${prefix}${SETTINGS_FILE}`,
            rule: 'names-config-invalid',
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
                rule: 'names-skill-file',
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
        ...[...roots]
            .toSorted((left, right) => (left < right ? -1 : 1))
            .filter((root) => !isCodified(root))
            .map((root) => foreignRoot(root, prefix)),
        ...declarationOf(declared, roots, prefix),
    ];
}

/**
 * The spine of the repository root, and of every workspace member: a member
 * is a package of its own, so its folders owe the same spine, and it declares
 * its own roots in its own settings file. A file belongs to the member that
 * holds it, and to the root otherwise.
 */
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

/** Every target a Makefile's own text writes a rule for. */
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

/**
 * What a repository's root owes the flows: a Makefile answering the
 * six gestures. Asked only where a repository is — a `.git` beside the root —
 * so a workspace member, a fixture or a bare directory is never asked.
 */
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
                rule: 'names-makefile-absent',
            },
        ];
    }

    const targets = targetsOf(readFileSync(join(root, MAKEFILE), 'utf8'));

    return MAKE_TARGETS.filter((target) => !targets.has(target)).map((target) => ({
        message: `\`make ${target}\` has no rule — every repository answers \`make\` ${gestures}`,
        path: MAKEFILE,
        rule: 'names-makefile-target',
    }));
}

/** An empty directory, in the four parts every finding of the family states. */
function emptyDirectoryFinding(path) {
    return {
        message: [
            `found: \`${path}/\` holds no file`,
            'why: git tracks no directory, so an empty one exists only on this machine and names a part of the tree that is not there',
            `fix: delete it — \`typescript fix\` does — or put the file it was made for in it`,
            'read: docs/06-quality-checks.md#an-empty-directory',
        ].join(' · '),
        path: `${path}/`,
        rule: 'names-directory-empty',
    };
}

/** The namespace the pass's rules take in the ratchet's file. */
const NAMESPACE = 'names/';

/** A finding as the ratchet reads one: `names(<rule>)` becomes `names/<rule>`. */
const codeOf = (rule) => `names(${rule})`;

/** The flags that take a value, so a value is never read as the root. */
const VALUED_FLAGS = new Set(['--format', '--ignore-pattern', '--report']);

/** The value an argument list carries after a flag, or undefined when it has none. */
const valueOf = (flag) => {
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

/* `--fix` settles the one finding a machine can settle before the tree is judged. */
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

/** The findings as the ratchet reads a report: oxlint's JSON shape, one code per rule. */
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

/* `check` reads the same findings back to state what the whole ratchet section holds. */
const reportPath = valueOf('--report');
if (reportPath !== undefined) {
    writeFileSync(reportPath, report());
}

for (const { message, path, rule } of findings) {
    stdout.write(`${rule}  ${path}  ${message}\n`);
}

/*
 * Where the file records this pass's side, its counts are the verdict. Where
 * it records none — or there is no file — every finding is a failure, exactly
 * as before a ratchet existed.
 */
const ownedOf = (section) =>
    Object.fromEntries(Object.entries(section).filter(([rule]) => rule.startsWith(NAMESPACE)));

let recorded = ownedOf(readBaseline(root) ?? {});

if (Object.keys(recorded).length === 0) {
    exit(findings.length > 0 ? 1 : 0);
}

const counts = {};
for (const { rule } of findings) {
    counts[`${NAMESPACE}${rule}`] = (counts[`${NAMESPACE}${rule}`] ?? 0) + 1;
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
