#!/usr/bin/env node

/**
 * The artefact convention, read off a project's `.gitignore` — and, in a
 * workspace, off the ancestor `.gitignore` that covers it too.
 *
 * Every build, test and lint artefact lives under `.artifacts/<tool>/` at the
 * project root — one folder per tool that writes. A `.gitignore` line naming an
 * artefact ANYWHERE else is the old layout, and this gate says so; `.artifacts/`
 * itself must be ignored, so the convention's own folder never reaches a commit.
 *
 * Two files are read, each judged by the same rules: the package's own
 * `.gitignore`, and the nearest ANCESTOR `.gitignore` above it — the workspace
 * root's, found by walking up to the nearest directory holding a lockfile or a
 * `workspaces` manifest. A workspace whose `lint` delegates to members runs this
 * gate once per member, cwd'd there; without the ancestor a root that ignores
 * `.artifacts/` for everyone would look, from a member with no `.gitignore` of
 * its own, exactly like a project declaring nothing. An ancestor pattern counts
 * only when it is NOT anchored to the ancestor's own directory (no `/` besides a
 * trailing one) — the same rule git applies when deciding whether a pattern
 * reaches into a nested directory.
 *
 * Usage: node check-gitignore.js [--fix] [--has-ancestor] [root]
 *
 * `--has-ancestor` answers, silently, whether an ancestor `.gitignore` exists
 * above `root` — the probe a caller uses to decide whether the gate has
 * anything to read when `root` itself carries no `.gitignore`.
 *
 * `--fix` rewrites the package's OWN `.gitignore` (never the ancestor's, which
 * is a different project's file): the artefact lines go, `.artifacts/` arrives,
 * and everything else — comments, blank lines, order, the project's own paths —
 * survives untouched. A `!` line is NEVER rewritten: it rescues a tracked file,
 * and deleting the line it negates could hide a real path. Those are reported.
 * Fix has nothing to do when the package owns no `.gitignore` of its own, even
 * if an ancestor exists — it never creates a file, only repairs one.
 *
 * Exit code: 0 when the project holds the convention, 1 otherwise. In `--fix`
 * mode only what the rewrite cannot repair — a committed artefact — still fails.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { argv, exit, stdout } from 'node:process';

/** The convention's own directory: the one path that MUST be ignored. */
const ARTIFACTS = '.artifacts';

/**
 * The one exception to the convention: a build's product stays beside `src/`
 * and is published from there, so `dist` is a legitimate ignored path.
 */
const PRODUCT = 'dist';

/** Directories a tool writes, and the `.artifacts/` home each one moves to. */
const ARTEFACT_DIRECTORIES = new Map([
    ['.cache', '.artifacts/<tool>/'],
    ['.next', '.artifacts/next/'],
    ['.turbo', '.artifacts/turbo/'],
    ['.vite', '.artifacts/vite/'],
    ['bin', '.artifacts/go/'],
    ['build', '.artifacts/<tool>/'],
    ['coverage', '.artifacts/coverage/'],
    ['out', '.artifacts/next/'],
    ['playwright-report', '.artifacts/playwright/'],
    ['target', '.artifacts/cargo/'],
    ['test-results', '.artifacts/playwright/'],
]);

/** Files a tool writes, matched on their extension, and where they belong. */
const ARTEFACT_EXTENSIONS = [
    ['.tsbuildinfo', '.artifacts/tsc/'],
    ['.log', '.artifacts/logs/'],
];

/**
 * The closed list of ignored paths that are NOT artefacts of the convention:
 * platform working directories a toolchain owns and cannot be told to move,
 * generated files a framework expects at a fixed path, and `node_modules`.
 */
const EXCEPTIONS = new Set([
    '.build',
    '.expo',
    '.gradle',
    '.swiftpm',
    '.vercel',
    'DerivedData',
    'Package.resolved',
    'android',
    'ios',
    'next-env.d.ts',
    'node_modules',
]);

/** The one exception spelled as a prefix — Expo stamps a suffix onto it. */
const EXCEPTION_PREFIXES = ['.metro-health-check'];

/**
 * `next.config.*` file names, in resolution order — mirrors what Next.js
 * itself tries, closely enough for a textual `output` read.
 */
const NEXT_CONFIG_FILES = [
    'next.config.js',
    'next.config.mjs',
    'next.config.ts',
    'next.config.mts',
    'next.config.cjs',
    'next.config.cts',
];

/**
 * With `output: 'export'`, Next reads `distDir` as the EXPORT destination and
 * keeps its working directory at `.next` regardless — `next/dist/export/utils.js`
 * (`hasCustomExportOutput`) refuses to move it. So `.next` cannot be told to
 * live under `.artifacts/next/` in that one mode, proven by a real consumer
 * (clawssify's site). Without `output: 'export'`, nothing pins it, and `.next`
 * stays an ordinary artefact. Read textually — a project's own config may not
 * even be valid JS in the tool's own runtime, and a regex answers the one
 * question this gate has without loading it.
 */
function nextConfigDeclaresExport(dir) {
    for (const name of NEXT_CONFIG_FILES) {
        const path = join(dir, name);
        if (!existsSync(path)) {
            continue;
        }
        try {
            if (/output\s*:\s*['"]export['"]/.test(readFileSync(path, 'utf8'))) {
                return true;
            }
        } catch {
            // An unreadable config answers no differently than a missing one.
        }
    }

    return false;
}

/** Lockfiles whose presence marks a directory as a package manager's root. */
const WORKSPACE_LOCKFILES = [
    'bun.lock',
    'bun.lockb',
    'npm-shrinkwrap.json',
    'package-lock.json',
    'pnpm-lock.yaml',
    'yarn.lock',
];

/** A workspace root: a lockfile lives here, or its manifest declares `workspaces`. */
function isWorkspaceRoot(dir) {
    if (WORKSPACE_LOCKFILES.some((name) => existsSync(join(dir, name)))) {
        return true;
    }

    const manifest = join(dir, 'package.json');
    if (!existsSync(manifest)) {
        return false;
    }

    try {
        return JSON.parse(readFileSync(manifest, 'utf8')).workspaces !== undefined;
    } catch {
        return false;
    }
}

/**
 * The nearest ancestor ABOVE `root` that is a workspace root, or null. Never
 * `root` itself — a project reads its OWN `.gitignore` regardless, so only
 * what sits above it is worth a second file.
 */
function findWorkspaceRoot(root) {
    let dir = dirname(resolve(root));
    let parent = dirname(dir);

    while (dir !== parent) {
        if (isWorkspaceRoot(dir)) {
            return dir;
        }
        dir = parent;
        parent = dirname(dir);
    }

    return isWorkspaceRoot(dir) ? dir : null;
}

/**
 * A pattern anchored to its OWN `.gitignore`'s directory — one that carries a
 * `/` other than a trailing one, or a leading one — the way git itself reads
 * it. An anchored pattern in an ANCESTOR's file never reaches a nested package;
 * only an unanchored one (`.artifacts/`, not `/.artifacts/` or `out/.artifacts/`)
 * matches at any depth below it.
 */
function isAnchored(pattern) {
    return pattern.replace(/\/+$/, '').includes('/');
}

/**
 * What a `.gitignore` pattern names, reduced to the one segment that carries
 * the meaning: an anchored form, a nested form and a doubled-star form all name
 * the same directory. A trailing `*` is dropped so `npm-debug.log*` reads as a
 * log, and a `**` segment never wins over the name that follows it.
 */
function subject(pattern) {
    const segments = pattern
        .replace(/\/+$/, '')
        .split('/')
        .filter((segment) => segment !== '' && segment !== '**');

    return (segments.at(-1) ?? '').replace(/\*$/, '');
}

/** The `.artifacts/` home of the artefact a pattern names, or null. */
function artefactHome(pattern, { nextIsExportDestination }) {
    const name = subject(pattern);

    if (name === '' || name === PRODUCT || EXCEPTIONS.has(name)) {
        return null;
    }
    if (nextIsExportDestination && name === '.next') {
        return null;
    }
    if (EXCEPTION_PREFIXES.some((prefix) => name.startsWith(prefix))) {
        return null;
    }
    if (ARTEFACT_DIRECTORIES.has(name)) {
        return ARTEFACT_DIRECTORIES.get(name);
    }
    for (const [extension, home] of ARTEFACT_EXTENSIONS) {
        if (name.endsWith(extension)) {
            return home;
        }
    }

    return null;
}

/** Every line of a `.gitignore`, classified once — the rewrite reads the same list. */
function readLines(gitignorePath) {
    const nextIsExportDestination = nextConfigDeclaresExport(dirname(gitignorePath));
    const text = readFileSync(gitignorePath, 'utf8').split('\n');

    // The empty string a trailing newline leaves behind is not a line.
    // Putting that newline back is the rewrite's job.
    if (text.at(-1) === '') {
        text.pop();
    }

    return text.map((line) => {
        const pattern = line.trim();
        const isPattern = pattern !== '' && !pattern.startsWith('#');

        return {
            home:
                isPattern && !pattern.startsWith('!')
                    ? artefactHome(pattern, { nextIsExportDestination })
                    : null,
            isNegation: isPattern && pattern.startsWith('!'),
            pattern,
            text: line,
        };
    });
}

/**
 * A `.gitignore` judged on its own: every line classified, plus what it
 * contributes to the combined verdict. `reach` narrows an ancestor's file to
 * the patterns that actually cross into a nested package — every line, for
 * the package's own file, since that file's directory IS the project root.
 */
function readSource(path, { own, reach = () => true, root }) {
    const lines = readLines(path);

    return {
        isIgnored: lines.some(
            (line) =>
                !line.isNegation &&
                line.home === null &&
                subject(line.pattern) === ARTIFACTS &&
                reach(line.pattern),
        ),
        label: relative(resolve(root), path).split('\\').join('/'),
        lines,
        misplaced: lines.filter((line) => line.home !== null && reach(line.pattern)),
        negations: lines.filter((line) => line.isNegation),
        own,
        path,
    };
}

/**
 * Directories whose every tracked file is a committed artefact. Narrower than
 * the list above on purpose: `bin`, `out`, `build` and `target` are ignorable
 * as OUTPUT, but a tracked file under them may be a project's own source —
 * a `.gitignore` line declares intent, a tracked path declares nothing.
 */
const TRACKED_ARTEFACT_DIRECTORIES = new Set([
    '.artifacts',
    '.cache',
    '.next',
    '.turbo',
    '.vite',
    'coverage',
    'playwright-report',
    'test-results',
]);

/** The extension no tracked file may carry — a buildinfo is never source. */
const TRACKED_ARTEFACT_EXTENSION = '.tsbuildinfo';

/**
 * The artefacts a project COMMITTED. Outside a git tree the question has no
 * answer, and silence is the right one — a fixture directory is not a repo.
 */
function trackedArtefacts(root) {
    let listed;
    try {
        listed = execFileSync('git', ['ls-files', '-z'], {
            cwd: root,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
        });
    } catch {
        return [];
    }

    return listed
        .split('\0')
        .filter((path) => path !== '')
        .filter((path) => {
            const segments = path.split('/');

            return (
                segments
                    .slice(0, -1)
                    .some((segment) => TRACKED_ARTEFACT_DIRECTORIES.has(segment)) ||
                path.endsWith(TRACKED_ARTEFACT_EXTENSION)
            );
        });
}

/** The rewritten file: artefact lines dropped, `.artifacts/` present, rest kept. */
function rewrite(lines) {
    const kept = lines.filter((line) => line.home === null);
    const isIgnored = kept.some((line) => !line.isNegation && subject(line.pattern) === ARTIFACTS);
    const body = kept.map((line) => line.text);

    if (!isIgnored) {
        while (body.length > 0 && body.at(-1).trim() === '') {
            body.pop();
        }
        body.push('', '# Build, test and lint artefacts (@jterrazz/typescript)', `${ARTIFACTS}/`);
    }

    return `${body.join('\n')}\n`;
}

const isFix = argv.includes('--fix');
const isProbe = argv.includes('--has-ancestor');
const root = argv.slice(2).find((argument) => !argument.startsWith('--')) ?? '.';

const workspaceRoot = findWorkspaceRoot(root);
const ancestorPath = workspaceRoot ? join(workspaceRoot, '.gitignore') : null;

// The probe answers one question — does an ancestor `.gitignore` exist above
// `root` — for a caller that already knows how to test `root`'s own.
if (isProbe) {
    exit(ancestorPath && existsSync(ancestorPath) ? 0 : 1);
}

const ownPath = join(root, '.gitignore');
const sources = [];
if (existsSync(ownPath)) {
    sources.push(readSource(ownPath, { own: true, root }));
}
if (ancestorPath && existsSync(ancestorPath)) {
    sources.push(
        readSource(ancestorPath, { own: false, reach: (pattern) => !isAnchored(pattern), root }),
    );
}

/*
 * Neither the package nor any ancestor above it declares an artefact path —
 * the gate has no question to ask, and stays silent.
 */
if (sources.length === 0) {
    exit(0);
}

/*
 * The combined verdict, own file and ancestor alike — an ancestor's line
 * already narrowed to what actually reaches this package (`readSource`'s
 * `reach`). Negations keep the original, file-agnostic wording: rescuing a
 * tracked file is the same judgement call regardless of which file names it.
 */
const isIgnored = sources.some((source) => source.isIgnored);
const misplaced = sources.flatMap((source) =>
    source.misplaced.map((line) => ({ ...line, source })),
);
const negations = sources.flatMap((source) => source.negations);

/*
 * When nobody ignores it, the file to fix is the shared one when there is
 * one — a workspace root covers every member, so that is where it belongs.
 */
const target = sources.find((source) => !source.own) ?? sources[0];

const tracked = trackedArtefacts(root);

if (isFix) {
    /*
     * Fix repairs the package's OWN file only — it never creates one, and it
     * never rewrites an ancestor, which is a different project's file.
     */
    const own = sources.find((source) => source.own);
    if (own) {
        const changed = own.misplaced.length > 0 || !own.isIgnored;
        if (changed) {
            writeFileSync(own.path, rewrite(own.lines));
            stdout.write('.gitignore rewritten:\n');
            for (const line of own.misplaced) {
                stdout.write(`  - ${line.pattern}\n`);
            }
            if (!own.isIgnored) {
                stdout.write(`  + ${ARTIFACTS}/\n`);
            }
            for (const line of own.negations) {
                stdout.write(`  · ${line.pattern} — a negation rescues a tracked file, kept\n`);
            }
        }
    }
} else if (misplaced.length > 0 || !isIgnored) {
    stdout.write('Artefacts belong under .artifacts/<tool>/ at the project root:\n');
    for (const line of misplaced) {
        stdout.write(`  ✗ ${line.source.label} names ${line.pattern} — its home is ${line.home}\n`);
    }
    if (!isIgnored) {
        stdout.write(`  ✗ ${target.label} does not ignore ${ARTIFACTS}/ — add it\n`);
    }
    for (const line of negations) {
        stdout.write(`  · ${line.pattern} — a negation rescues a tracked file, left for you\n`);
    }
    stdout.write("Run 'typescript fix' to rewrite .gitignore.\n");
}

if (tracked.length > 0) {
    stdout.write('Artefacts must never be committed:\n');
    for (const path of tracked) {
        stdout.write(`  ✗ ${path} is tracked — git rm --cached ${path}\n`);
    }
}

exit(tracked.length > 0 || (!isFix && (misplaced.length > 0 || !isIgnored)) ? 1 : 0);
