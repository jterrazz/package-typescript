#!/usr/bin/env node

/**
 * The artefact convention, read off a project's `.gitignore`.
 *
 * Every build, test and lint artefact lives under `.artifacts/<tool>/` at the
 * project root — one folder per tool that writes. A `.gitignore` line naming an
 * artefact ANYWHERE else is the old layout, and this gate says so; `.artifacts/`
 * itself must be ignored, so the convention's own folder never reaches a commit.
 *
 * Usage: node check-gitignore.js [--fix] [root]
 *
 * `--fix` rewrites the `.gitignore`: the artefact lines go, `.artifacts/` arrives,
 * and everything else — comments, blank lines, order, the project's own paths —
 * survives untouched. A `!` line is NEVER rewritten: it rescues a tracked file,
 * and deleting the line it negates could hide a real path. Those are reported.
 *
 * Exit code: 0 when the project holds the convention, 1 otherwise. In `--fix`
 * mode only what the rewrite cannot repair — a committed artefact — still fails.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
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
function artefactHome(pattern) {
    const name = subject(pattern);

    if (name === '' || name === PRODUCT || EXCEPTIONS.has(name)) {
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

/** Every line of the file, classified once — the rewrite reads the same list. */
function readLines(gitignorePath) {
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
            home: isPattern && !pattern.startsWith('!') ? artefactHome(pattern) : null,
            isNegation: isPattern && pattern.startsWith('!'),
            pattern,
            text: line,
        };
    });
}

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
const root = argv.slice(2).find((argument) => !argument.startsWith('--')) ?? '.';
const gitignorePath = join(root, '.gitignore');

// A project with no `.gitignore` declares no artefact path and nothing to fix.
// The gate has no question to ask of it, and stays silent.
if (!existsSync(gitignorePath)) {
    exit(0);
}

const lines = readLines(gitignorePath);
const misplaced = lines.filter((line) => line.home !== null);
const negations = lines.filter((line) => line.isNegation);
const isIgnored = lines.some(
    (line) => !line.isNegation && line.home === null && subject(line.pattern) === ARTIFACTS,
);
const tracked = trackedArtefacts(root);

if (isFix) {
    const changed = misplaced.length > 0 || !isIgnored;
    if (changed) {
        writeFileSync(gitignorePath, rewrite(lines));
        stdout.write('.gitignore rewritten:\n');
        for (const line of misplaced) {
            stdout.write(`  - ${line.pattern}\n`);
        }
        if (!isIgnored) {
            stdout.write(`  + ${ARTIFACTS}/\n`);
        }
        for (const line of negations) {
            stdout.write(`  · ${line.pattern} — a negation rescues a tracked file, kept\n`);
        }
    }
} else if (misplaced.length > 0 || !isIgnored) {
    stdout.write('Artefacts belong under .artifacts/<tool>/ at the project root:\n');
    for (const line of misplaced) {
        stdout.write(`  ✗ .gitignore names ${line.pattern} — its home is ${line.home}\n`);
    }
    if (!isIgnored) {
        stdout.write(`  ✗ .gitignore does not ignore ${ARTIFACTS}/ — add it\n`);
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
