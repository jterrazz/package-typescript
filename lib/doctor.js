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
 * Usage: node doctor.js
 *
 * One row per tool: what is installed, what is declared, and the verdict. Older
 * than the range FAILS — a gate running an older linter is enforcing an older
 * rulebook without saying so. Newer WARNS: a tool ahead of its range may be
 * fine, and the toolchain is not the thing that gets to decide that.
 *
 * Exit code: 0 when nothing is old or absent, 1 otherwise.
 */

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import process, { exit, stdout } from 'node:process';

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

/* Imported for `toolVersions`, run for the report — never both at once. */
if (import.meta.main) {
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

    exit(failed ? 1 : 0);
}
