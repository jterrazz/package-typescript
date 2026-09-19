#!/usr/bin/env node

/**
 * The `@jterrazz/test` a package would LOAD, and the checker binary that comes
 * with it — found the way node finds them, from the package outward.
 *
 * A package is a consumer of what it can RESOLVE, not of what it names: npm
 * hoists a workspace's shared devDependency to the root, so a member declaring
 * nothing still loads it. Version and binary are answered from the one install
 * the walk lands on, so a workspace whose members hold different releases is
 * never judged by whichever one the root happens to carry.
 *
 * The lookup is the ancestor walk itself rather than `require.resolve`: the
 * package's `exports` map does not publish `./package.json`, so the resolver
 * refuses the one path that carries the version.
 *
 * The walk stops at the nearest repository boundary
 * ([repository-root.js](repository-root.js)): a clone sitting inside another
 * tree loads its own install or none, and the estate's `node_modules` never
 * makes a consumer of a project that declares nothing.
 *
 * Usage: node test-package.js <dir> [--at-least <version>]
 *        node test-package.js <dir> --bin
 *        node test-package.js --floor
 *
 * Prints the resolved version — or, with `--bin`, the absolute path of the
 * checker entry the install declares. Exit code: 0 when it resolves — and,
 * with `--at-least`, when it is that version or newer — 1 otherwise. `--floor`
 * prints the release the checker's own flags arrive in, so the callers that
 * gate on it read one number rather than each keeping a copy.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { argv, exit, stdout } from 'node:process';

import { isRepositoryRoot } from './repository-root.js';

/** The package every lookup here is about. */
const PACKAGE = '@jterrazz/test';

/** The binary it publishes, and the one the quality checks run. */
const CHECKER_BIN = 'jterrazz-test-check';

/**
 * The release that answers the flags `typescript check` and `typescript
 * baseline` call it with — `--member` and `--format json`. Below it both are
 * skipped, and the gates say so rather than pretending they ran.
 */
export const CHECKER_FLOOR = '15.3.0';

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
 * The install of `@jterrazz/test` reachable from `dir` — its directory and its
 * manifest — or null. Every `node_modules` from the directory up to the
 * repository boundary is asked, nearest first, which is the order node itself
 * resolves in.
 */
export function resolveTestPackage(dir) {
    let current = resolve(dir);

    while (true) {
        const installed = join(current, 'node_modules', PACKAGE);
        const manifest = join(installed, 'package.json');
        if (existsSync(manifest)) {
            try {
                return { dir: installed, manifest: JSON.parse(readFileSync(manifest, 'utf8')) };
            } catch {
                return null;
            }
        }

        const parent = dirname(current);
        if (isRepositoryRoot(current) || parent === current) {
            return null;
        }
        current = parent;
    }
}

/** The version of `@jterrazz/test` reachable from `dir`, or null. */
export function testPackageVersion(dir) {
    const { manifest } = resolveTestPackage(dir) ?? {};

    return typeof manifest?.version === 'string' ? manifest.version : null;
}

/**
 * The conventions checker `dir` would run, or null. It is the entry the SAME
 * install declares, not a name on PATH: a `node_modules/.bin` shim answers for
 * whichever member npm hoisted to, and PATH answers for nothing at all in a
 * published install.
 */
export function testPackageBin(dir) {
    const resolved = resolveTestPackage(dir);
    if (resolved === null) {
        return null;
    }

    const { bin } = resolved.manifest;
    const entry = typeof bin === 'string' ? bin : bin?.[CHECKER_BIN];
    if (typeof entry !== 'string') {
        return null;
    }

    const path = join(resolved.dir, entry);

    return existsSync(path) ? path : null;
}

/** Whether what `dir` resolves is at least `floor`. */
export function testPackageAtLeast(dir, floor) {
    const version = testPackageVersion(dir);

    return version !== null && compare(version, floor) >= 0;
}

/* Imported for the walk, run for the answer — never both at once. */
if (import.meta.main) {
    if (argv.includes('--floor')) {
        stdout.write(`${CHECKER_FLOOR}\n`);
        exit(0);
    }

    const floorIndex = argv.indexOf('--at-least');
    const floor = floorIndex === -1 ? null : (argv[floorIndex + 1] ?? null);
    const dir =
        argv
            .slice(2)
            .find(
                (argument, index) => !argument.startsWith('--') && index + 2 !== floorIndex + 1,
            ) ?? '.';

    if (argv.includes('--bin')) {
        const bin = testPackageBin(dir);
        if (bin === null) {
            exit(1);
        }

        stdout.write(`${bin}\n`);
        exit(0);
    }

    const version = testPackageVersion(dir);
    if (version === null) {
        exit(1);
    }

    stdout.write(`${version}\n`);
    exit(floor === null || compare(version, floor) >= 0 ? 0 : 1);
}
