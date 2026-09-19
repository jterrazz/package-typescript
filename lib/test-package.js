#!/usr/bin/env node

/**
 * The `@jterrazz/test` a package would LOAD, found the way node finds it.
 *
 * The conventions checker is a gate on a package that USES @jterrazz/test, and
 * a package uses what it can resolve, not what it names: npm hoists a
 * workspace's shared devDependency to the root, so a member declaring nothing
 * still loads it, and gating on the member's own `package.json` left every
 * hoisted member unchecked (`apps/console` and `apps/cli` of jterrazz-os, whose
 * only declaration is the root's).
 *
 * The lookup is the ancestor walk itself rather than `require.resolve`: the
 * package's `exports` map does not publish `./package.json`, so the resolver
 * refuses the one path that carries the version, and a gate cannot depend on a
 * map the package is free to change.
 *
 * Usage: node test-package.js <dir> [--at-least <version>]
 *
 * Prints the resolved version. Exit code: 0 when it resolves — and, with
 * `--at-least`, when it is that version or newer — 1 otherwise.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { argv, exit, stdout } from 'node:process';

/** The package every lookup here is about. */
const PACKAGE = '@jterrazz/test';

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
 * The version of `@jterrazz/test` reachable from `dir`, or null. Every
 * `node_modules` above the directory is asked, nearest first — the order node
 * itself resolves in.
 */
export function testPackageVersion(dir) {
    let current = resolve(dir);

    while (true) {
        const manifest = join(current, 'node_modules', PACKAGE, 'package.json');
        if (existsSync(manifest)) {
            try {
                const { version } = JSON.parse(readFileSync(manifest, 'utf8'));
                return typeof version === 'string' ? version : null;
            } catch {
                return null;
            }
        }

        const parent = dirname(current);
        if (parent === current) {
            return null;
        }
        current = parent;
    }
}

/** Whether what `dir` resolves is at least `floor`. */
export function testPackageAtLeast(dir, floor) {
    const version = testPackageVersion(dir);

    return version !== null && compare(version, floor) >= 0;
}

/* Imported for the walk, run for the answer — never both at once. */
if (import.meta.main) {
    const floorIndex = argv.indexOf('--at-least');
    const floor = floorIndex === -1 ? null : (argv[floorIndex + 1] ?? null);
    const dir =
        argv
            .slice(2)
            .find(
                (argument, index) => !argument.startsWith('--') && index + 2 !== floorIndex + 1,
            ) ?? '.';

    const version = testPackageVersion(dir);
    if (version === null) {
        exit(1);
    }

    stdout.write(`${version}\n`);
    exit(floor === null || compare(version, floor) >= 0 ? 0 : 1);
}
