#!/usr/bin/env node

/**
 * What the toolchain is actually running, against what it says it needs.
 *
 * Every version here is read from an INSTALLED package's own manifest rather
 * than from a lockfile or a `--version` flag: a lockfile says what should have
 * been installed, and two of these tools answer `--version` in a shape of their
 * own or not at all. The declared ranges are this package's `package.json`, so
 * the two halves of every row come from the two places that can disagree.
 *
 * Usage: node doctor.js [project root]
 *
 * One row per tool: what is installed, what is declared, and the verdict. Older
 * than the range FAILS — a gate running an older linter is enforcing an older
 * rulebook without saying so. Newer WARNS: a tool ahead of its range may be
 * fine, and the toolchain is not the thing that gets to decide that.
 *
 * Then one section the PROJECT owns rather than the toolchain: a pair of
 * packages that must be pinned to the same version, read off the project's
 * lockfile. Vitest's browser provider is published from vitest's own
 * repository and versioned with it — a provider a patch away from the runner
 * loads a second copy of vitest's internals and fails at run time, in the
 * browser, with a stack nobody reads as a version skew. The lockfile is the
 * right file for this one question: it says what a fresh install resolves,
 * which is what a runner will get, where a range says only what was allowed.
 *
 * Exit code: 0 when nothing is old, absent or skewed, 1 otherwise.
 */

import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import process, { argv, cwd, exit, stdout } from 'node:process';

const require = createRequire(import.meta.url);
const PACKAGE_ROOT = resolve(import.meta.dirname, '..');

/** A manifest off the disk. Every version this file reports is read this way. */
function manifestAt(path) {
    return JSON.parse(readFileSync(path, 'utf8'));
}

const manifest = manifestAt(resolve(PACKAGE_ROOT, 'package.json'));

/** The per-platform package that carries the TypeScript 7 Go compiler here. */
function goCompilerPackage() {
    const os = { darwin: 'darwin', linux: 'linux', win32: 'win32' }[process.platform] ?? 'linux';
    const arch = { arm: 'arm', arm64: 'arm64', x64: 'x64' }[process.arch] ?? 'x64';

    return `@typescript/typescript-${os}-${arch}`;
}

/**
 * An installed package's own version, or null when it is not there. A manifest
 * is read through the resolver first and off the disk second: a package whose
 * `exports` map does not publish `./package.json` — knip is one — is invisible
 * to `require`, and the two directories below are the same two `find_binary`
 * walks in `check.sh`.
 */
function installedVersion(name) {
    for (const at of [
        () => require.resolve(`${name}/package.json`),
        () => resolve(PACKAGE_ROOT, 'node_modules', name, 'package.json'),
        () => resolve(PACKAGE_ROOT, '../..', name, 'package.json'),
    ]) {
        try {
            return manifestAt(at()).version;
        } catch {
            continue;
        }
    }

    return null;
}

/** `1.83.0` as `[1, 83, 0]`, with anything after a `-` or `+` dropped. */
function parts(version) {
    return version
        .split(/[+-]/u)[0]
        .split('.')
        .map((piece) => Number.parseInt(piece, 10) || 0);
}

/** Negative when left is older, positive when newer, zero when the same. */
function compare(left, right) {
    const [a, b] = [parts(left), parts(right)];
    for (let index = 0; index < 3; index += 1) {
        if ((a[index] ?? 0) !== (b[index] ?? 0)) {
            return (a[index] ?? 0) - (b[index] ?? 0);
        }
    }

    return 0;
}

/**
 * The floor a range asks for, and the first version it refuses. `^` follows
 * npm: below 1.0.0 a caret allows the patch line only, which is exactly why
 * oxfmt's range moves on every minor.
 */
function boundsOf(range) {
    const floor = range.replace(/^[\^>=~ ]+/u, '');
    const [major = 0, minor = 0] = parts(floor);

    if (range.startsWith('^')) {
        return { ceiling: major === 0 ? `0.${minor + 1}.0` : `${major + 1}.0.0`, floor };
    }
    if (range.startsWith('>=') || range.startsWith('>')) {
        return { ceiling: null, floor };
    }
    if (range.startsWith('~')) {
        return { ceiling: `${major}.${minor + 1}.0`, floor };
    }

    return { ceiling: floor, exact: true, floor };
}

/** Where an installed version stands against a declared range. */
function verdictOf(installed, range) {
    if (installed === null) {
        return 'absent';
    }

    const { ceiling, exact, floor } = boundsOf(range);
    if (compare(installed, floor) < 0) {
        return 'old';
    }
    if (exact === true) {
        return compare(installed, floor) === 0 ? 'ok' : 'newer';
    }

    return ceiling !== null && compare(installed, ceiling) >= 0 ? 'newer' : 'ok';
}

const declared = {
    ...manifest.dependencies,
    ...manifest.optionalDependencies,
};

/**
 * Every tool the toolchain runs, with what is installed, what is declared and
 * where the two stand. The drift report reads the same rows and prints only the
 * ones that deviate, so a version is answered for in one place.
 */
export function toolVersions() {
    return [
        ['node', process.version.replace(/^v/u, ''), manifest.engines?.node ?? '*'],
        ['tsc (Go)', installedVersion(goCompilerPackage()), declared[goCompilerPackage()] ?? '*'],
        ['typescript', installedVersion('typescript'), declared.typescript ?? '*'],
        ['oxlint', installedVersion('oxlint'), declared.oxlint ?? '*'],
        ['oxfmt', installedVersion('oxfmt'), declared.oxfmt ?? '*'],
        [
            'oxlint-tsgolint',
            installedVersion('oxlint-tsgolint'),
            declared['oxlint-tsgolint'] ?? '*',
        ],
        ['knip', installedVersion('knip'), declared.knip ?? '*'],
    ].map(([name, installed, range]) => ({
        installed,
        name,
        range,
        verdict: verdictOf(installed, range),
    }));
}

/**
 * The pair a browser-mode consumer must keep equal, and the reason the check
 * exists at all: `@vitest/browser-playwright` ships from vitest's repository
 * and carries vitest's version, so anything but an exact match is a skew.
 */
export const PINNED_PAIR = Object.freeze({
    provider: '@vitest/browser-playwright',
    runner: 'vitest',
});

/** Lockfiles this report can read, in the order a resolver would find them. */
const READ_LOCKFILES = ['package-lock.json', 'npm-shrinkwrap.json'];

/** Lockfiles it cannot: neither format is JSON, and neither is parsed here. */
const UNREAD_LOCKFILES = ['bun.lock', 'bun.lockb', 'pnpm-lock.yaml', 'yarn.lock'];

/** Every version an npm lockfile resolves for one package name, deduplicated. */
function lockedVersions(lock, name) {
    const suffix = `node_modules/${name}`;
    const versions = new Set();

    for (const [path, entry] of Object.entries(lock.packages ?? {})) {
        if ((path === suffix || path.endsWith(`/${suffix}`)) && typeof entry.version === 'string') {
            versions.add(entry.version);
        }
    }

    return [...versions].toSorted((left, right) => (left < right ? -1 : 1));
}

/** Whether the project's own manifest declares a package, under any dependency key. */
function manifestDeclares(root, name) {
    try {
        const pkg = manifestAt(join(root, 'package.json'));
        return (
            { ...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies }[name] !==
            undefined
        );
    } catch {
        return false;
    }
}

/**
 * What the project's lockfile says about the pinned pair. `null` when there is
 * no question to answer — no lockfile this report reads, and no provider
 * declared under one it does not.
 */
export function pinnedPair(root) {
    const readable = READ_LOCKFILES.map((name) => join(root, name)).find((path) =>
        existsSync(path),
    );

    if (readable === undefined) {
        const unread = UNREAD_LOCKFILES.find((name) => existsSync(join(root, name)));
        if (unread !== undefined && manifestDeclares(root, PINNED_PAIR.provider)) {
            return { unread, verdict: 'unread' };
        }

        return null;
    }

    let lock;
    try {
        lock = manifestAt(readable);
    } catch {
        return null;
    }

    const provider = lockedVersions(lock, PINNED_PAIR.provider);
    if (provider.length === 0) {
        return null;
    }

    const runner = lockedVersions(lock, PINNED_PAIR.runner);
    const matched = runner.length === 1 && provider.length === 1 && runner[0] === provider[0];

    return { provider, runner, verdict: matched ? 'ok' : 'skewed' };
}

/** Every version a name resolves to, in one column — `—` when the lockfile has none. */
function versionColumn(versions) {
    return versions.length === 0 ? '—' : versions.join(', ');
}

/** The pinned-pair section, or nothing at all when the project asks no question. */
function reportPinnedPair(root) {
    const pair = pinnedPair(root);
    if (pair === null) {
        return false;
    }

    stdout.write('\nPinned together\n\n');

    if (pair.verdict === 'unread') {
        stdout.write(
            `  ${PINNED_PAIR.provider.padEnd(28)}${pair.unread} is not parsed here — the pin is unchecked\n\n`,
        );
        return false;
    }

    stdout.write(`  ${PINNED_PAIR.runner.padEnd(28)}${versionColumn(pair.runner)}\n`);
    stdout.write(
        `  ${PINNED_PAIR.provider.padEnd(28)}${versionColumn(pair.provider).padEnd(12)}${pair.verdict}\n\n`,
    );

    if (pair.verdict === 'skewed') {
        stdout.write(
            `${PINNED_PAIR.provider} is versioned with ${PINNED_PAIR.runner} and must equal it exactly — pin both to the same version.\n`,
        );
    }

    return pair.verdict === 'skewed';
}

/* Imported for `toolVersions`, run for the report — never both at once. */
if (import.meta.main) {
    const root = resolve(argv[2] ?? cwd());
    const rows = toolVersions();
    const failed = rows.some(({ verdict }) => verdict === 'old' || verdict === 'absent');
    const warned = rows.some(({ verdict }) => verdict === 'newer');

    stdout.write('Toolchain versions\n\n');

    for (const { installed, name, range, verdict } of rows) {
        stdout.write(
            `  ${name.padEnd(16)}${(installed ?? '—').padEnd(12)}${range.padEnd(12)}${verdict}\n`,
        );
    }

    stdout.write('\n');

    if (failed) {
        stdout.write('A tool older than its range enforces an older rulebook without saying so.\n');
    } else if (warned) {
        stdout.write(
            'A tool ahead of its range may be fine; the toolchain does not get to decide.\n',
        );
    } else {
        stdout.write('Every tool is in range.\n');
    }

    const skewed = reportPinnedPair(root);

    exit(failed || skewed ? 1 : 0);
}
