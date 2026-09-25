#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import process, { argv, cwd, exit, stdout } from 'node:process';

import { workspaceMembers } from './workspace-members.js';

const require = createRequire(import.meta.url);
const PACKAGE_ROOT = resolve(import.meta.dirname, '../..');

// Versions are read off installed manifests: two of these tools answer `--version` in a shape of their own.
function manifestAt(path) {
    return JSON.parse(readFileSync(path, 'utf8'));
}

const manifest = manifestAt(resolve(PACKAGE_ROOT, 'package.json'));

function goCompilerPackage() {
    const os = { darwin: 'darwin', linux: 'linux', win32: 'win32' }[process.platform] ?? 'linux';
    const arch = { arm: 'arm', arm64: 'arm64', x64: 'x64' }[process.arch] ?? 'x64';

    return `@typescript/typescript-${os}-${arch}`;
}

// A package whose `exports` hides `./package.json` (knip) is invisible to `require`; the two
// directories after it are the ones `find_binary` walks in `check.sh`.
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

function versionParts(version) {
    return version
        .split(/[+-]/u)[0]
        .split('.')
        .map((piece) => Number.parseInt(piece, 10) || 0);
}

function compareVersions(left, right) {
    const [a, b] = [versionParts(left), versionParts(right)];
    for (let index = 0; index < 3; index += 1) {
        if ((a[index] ?? 0) !== (b[index] ?? 0)) {
            return (a[index] ?? 0) - (b[index] ?? 0);
        }
    }

    return 0;
}

// As npm reads it: below 1.0.0 a caret allows the patch line only.
function boundsOf(range) {
    const floor = range.replace(/^[\^>=~ ]+/u, '');
    const [major = 0, minor = 0] = versionParts(floor);

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

function verdictOf(installed, range) {
    if (installed === null) {
        return 'absent';
    }

    const { ceiling, exact, floor } = boundsOf(range);
    if (compareVersions(installed, floor) < 0) {
        return 'old';
    }
    if (exact === true) {
        return compareVersions(installed, floor) === 0 ? 'ok' : 'newer';
    }

    return ceiling !== null && compareVersions(installed, ceiling) >= 0 ? 'newer' : 'ok';
}

const declared = {
    ...manifest.dependencies,
    ...manifest.optionalDependencies,
};

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

// `@vitest/browser-playwright` ships from vitest's repository with vitest's version: a patch
// apart loads a second copy of vitest's internals and fails in the browser.
export const PINNED_PAIR = Object.freeze({
    provider: '@vitest/browser-playwright',
    runner: 'vitest',
});

function npmVersions(text, name) {
    const suffix = `node_modules/${name}`;
    const versions = new Set();

    for (const [path, entry] of Object.entries(JSON.parse(text).packages ?? {})) {
        if ((path === suffix || path.endsWith(`/${suffix}`)) && typeof entry.version === 'string') {
            versions.add(entry.version);
        }
    }

    return versions;
}

// `bun.lock` is JSON with trailing commas.
function bunVersions(text, name) {
    const versions = new Set();
    const { packages } = JSON.parse(text.replaceAll(/,(?<trailing>\s*[\]}])/gu, '$<trailing>'));

    for (const [key, entry] of Object.entries(packages ?? {})) {
        const descriptor = Array.isArray(entry) ? entry[0] : entry;
        if ((key === name || key.endsWith(`/${name}`)) && typeof descriptor === 'string') {
            versions.add(descriptor.slice(descriptor.lastIndexOf('@') + 1));
        }
    }

    return versions;
}

const READ_LOCKFILES = [
    ['package-lock.json', npmVersions],
    ['npm-shrinkwrap.json', npmVersions],
    ['bun.lock', bunVersions],
];

const UNREAD_LOCKFILES = ['bun.lockb', 'pnpm-lock.yaml', 'yarn.lock'];

function lockedVersions(path, read, name) {
    try {
        return [...read(readFileSync(path, 'utf8'), name)].toSorted((left, right) =>
            left < right ? -1 : 1,
        );
    } catch {
        return null;
    }
}

// In a monorepo the member running browser mode declares the provider, not the root.
function declaredAnywhere(root, name) {
    return ['.', ...workspaceMembers(root)].some((member) => {
        try {
            const pkg = manifestAt(join(root, member, 'package.json'));
            return (
                { ...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies }[name] !==
                undefined
            );
        } catch {
            return false;
        }
    });
}

export function pinnedPair(root) {
    const readable = READ_LOCKFILES.map(([name, read]) => [join(root, name), read]).find(([path]) =>
        existsSync(path),
    );

    if (readable === undefined) {
        const unread = UNREAD_LOCKFILES.find((name) => existsSync(join(root, name)));
        if (unread !== undefined && declaredAnywhere(root, PINNED_PAIR.provider)) {
            return { unread, verdict: 'unread' };
        }

        return null;
    }

    const provider = lockedVersions(readable[0], readable[1], PINNED_PAIR.provider);
    if (provider === null || provider.length === 0) {
        return null;
    }

    const runner = lockedVersions(readable[0], readable[1], PINNED_PAIR.runner) ?? [];
    const matched = runner.length === 1 && provider.length === 1 && runner[0] === provider[0];

    return { provider, runner, verdict: matched ? 'ok' : 'skewed' };
}

function versionColumn(versions) {
    return versions.length === 0 ? '—' : versions.join(', ');
}

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
