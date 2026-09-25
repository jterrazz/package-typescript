#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { argv, exit, stdout } from 'node:process';

import { isRepositoryRoot } from './repository-root.js';

const ARTIFACTS = '.artifacts';

// A build's product stays beside `src/` and is published from there.
const PRODUCT = 'dist';

const ARTEFACT_DIRECTORIES = new Map([
    ['.cache', '.artifacts/<tool>/'],
    ['.next', '.artifacts/next/'],
    ['.vite', '.artifacts/vite/'],
    ['bin', '.artifacts/go/'],
    ['build', '.artifacts/<tool>/'],
    ['coverage', '.artifacts/vitest/coverage/'],
    ['out', '.artifacts/next/'],
    ['playwright-report', '.artifacts/playwright/'],
    ['target', '.artifacts/cargo/'],
    ['test-results', '.artifacts/playwright/'],
]);

const ARTEFACT_EXTENSIONS = [
    ['.tsbuildinfo', '.artifacts/tsc/'],
    ['.log', '.artifacts/logs/'],
];

// Paths a toolchain owns and cannot be told to move, or a framework expects at a fixed path.
const EXCEPTIONS = new Set([
    '.build',
    '.expo',
    '.gradle',
    '.swiftpm',
    // Turborepo's `.turbo/turbo-<task>.log` has no key, flag or variable to move it.
    '.turbo',
    '.vercel',
    'DerivedData',
    'Package.resolved',
    'android',
    'ios',
    'next-env.d.ts',
    'node_modules',
]);

// Expo stamps a suffix onto it.
const EXCEPTION_PREFIXES = ['.metro-health-check'];

const NEXT_CONFIG_FILES = [
    'next.config.js',
    'next.config.mjs',
    'next.config.ts',
    'next.config.mts',
    'next.config.cjs',
    'next.config.cts',
];

// With `output: 'export'`, Next keeps its working directory at `.next` whatever `distDir` says
// (`next/dist/export/utils.js`, `hasCustomExportOutput`). Read as text: a config may not load here.
function nextConfigDeclaresExport(dir) {
    for (const name of NEXT_CONFIG_FILES) {
        const path = join(dir, name);
        if (!existsSync(path)) {
            continue;
        }
        try {
            if (/output\s*:\s*['"]export['"]/u.test(readFileSync(path, 'utf8'))) {
                return true;
            }
        } catch {
            // An unreadable config answers as a missing one does.
        }
    }

    return false;
}

const WORKSPACE_LOCKFILES = [
    'bun.lock',
    'bun.lockb',
    'npm-shrinkwrap.json',
    'package-lock.json',
    'pnpm-lock.yaml',
    'yarn.lock',
];

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

// Never passes the nearest repository boundary, so a `root` with its own `.git` has no ancestor.
function findWorkspaceRoot(root) {
    const start = resolve(root);
    if (isRepositoryRoot(start)) {
        return null;
    }

    let dir = dirname(start);
    let parent = dirname(dir);

    while (dir !== parent) {
        if (isWorkspaceRoot(dir)) {
            return dir;
        }
        if (isRepositoryRoot(dir)) {
            return null;
        }
        dir = parent;
        parent = dirname(dir);
    }

    return isWorkspaceRoot(dir) ? dir : null;
}

// git's own reading: an anchored pattern in an ancestor's file never reaches a nested package.
function isAnchored(pattern) {
    return pattern.replace(/\/+$/u, '').includes('/');
}

// `/out/`, `out/` and `**/out` all name `out`; `npm-debug.log*` reads as a log.
function lastNamedSegment(pattern) {
    const segments = pattern
        .replace(/\/+$/u, '')
        .split('/')
        .filter((segment) => segment !== '' && segment !== '**');

    return (segments.at(-1) ?? '').replace(/\*$/u, '');
}

function artefactHome(pattern, { nextIsExportDestination }) {
    const name = lastNamedSegment(pattern);

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

function readLines(gitignorePath) {
    const nextIsExportDestination = nextConfigDeclaresExport(dirname(gitignorePath));
    const text = readFileSync(gitignorePath, 'utf8').split('\n');

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

function readSource(path, { own, reach = () => true, root }) {
    const lines = readLines(path);

    return {
        isIgnored: lines.some(
            (line) =>
                !line.isNegation &&
                line.home === null &&
                lastNamedSegment(line.pattern) === ARTIFACTS &&
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

// Narrower than ARTEFACT_DIRECTORIES: a tracked file under `bin/` or `build/` may be source.
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

const TRACKED_ARTEFACT_EXTENSION = '.tsbuildinfo';

// Outside a git tree there is nothing committed to judge.
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

function rewrite(lines) {
    const kept = lines.filter((line) => line.home === null);
    const isIgnored = kept.some(
        (line) => !line.isNegation && lastNamedSegment(line.pattern) === ARTIFACTS,
    );
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

if (sources.length === 0) {
    exit(0);
}

const isIgnored = sources.some((source) => source.isIgnored);
const misplaced = sources.flatMap((source) =>
    source.misplaced.map((line) => ({ ...line, source })),
);
const negations = sources.flatMap((source) => source.negations);

// A workspace root's file covers every member, so a missing `.artifacts/` belongs there.
const target = sources.find((source) => !source.own) ?? sources[0];

const tracked = trackedArtefacts(root);

if (isFix) {
    // Only the package's own file: never created, and an ancestor is a different project's.
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
