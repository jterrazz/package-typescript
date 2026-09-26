#!/usr/bin/env node

// Found the way node resolves, from the package outward to the repository boundary: npm hoists a
// shared devDependency, and `@jterrazz/test`'s `exports` hides `./package.json` from `require.resolve`.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { argv, exit, stdout } from 'node:process';

import { isRepositoryRoot } from './repository-root.js';

const PACKAGE = '@jterrazz/test';

const CHECKER_BIN = 'jterrazz-test-check';

// The release that answers `--member`; below it the member pass is skipped, and says so.
export const CHECKER_FLOOR = '15.3.0';

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

export function testPackageVersion(dir) {
    const { manifest } = resolveTestPackage(dir) ?? {};

    return typeof manifest?.version === 'string' ? manifest.version : null;
}

// The entry the same install declares: a `.bin` shim answers for whichever member npm hoisted to.
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

export function testPackageAtLeast(dir, floor) {
    const version = testPackageVersion(dir);

    return version !== null && compareVersions(version, floor) >= 0;
}

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
    exit(floor === null || compareVersions(version, floor) >= 0 ? 0 : 1);
}
