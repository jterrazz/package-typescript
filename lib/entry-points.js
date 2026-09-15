#!/usr/bin/env node

/**
 * The entries a build compiles, read off the consumer's own `exports` map.
 *
 * A package with several public subpaths — `./register`, `./testing`, `./oxlint`
 * — used to need a `tsdown.config.ts` of its own to name them, which means
 * declaring tsdown as a dependency, which is the one-devDependency contract
 * broken ([Developing](../docs/02-developing.md)). The map already says what
 * the package publishes, so the build reads it there.
 *
 * The rule: every subpath whose target is a file under `dist/` is compiled from
 * the same path under `src/`, with a `.ts` extension. A subpath carrying a `*`
 * is skipped — a pattern names a set the map does not enumerate — and so is a
 * target the source tree has no file for, because a build cannot compile what
 * nobody wrote.
 *
 * Prints one entry per line, sorted; prints NOTHING when the package has no
 * exports map or no subpath resolves, and the caller then keeps the preset's
 * single `src/index.ts`.
 *
 * Usage: node entry-points.js [project-root]
 */

import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { argv, stdout } from 'node:process';

/**
 * The file a subpath's condition tree points at, in the order Node resolves
 * them. The empty string is "no target": a condition tree is data, and every
 * answer here is a path.
 */
function targetOf(entry) {
    if (typeof entry === 'string') {
        return entry;
    }
    if (typeof entry !== 'object' || entry === null) {
        return '';
    }
    for (const condition of ['import', 'default', 'require']) {
        const nested = targetOf(entry[condition]);
        if (nested !== '') {
            return nested;
        }
    }
    return '';
}

/** `./dist/register.js` -> `src/register.ts`, and the empty string otherwise. */
function sourceOf(target) {
    const match = /^\.\/dist\/(?<path>.+)\.(?:js|mjs|cjs)$/u.exec(target);
    return match === null ? '' : `src/${match.groups.path}.ts`;
}

/** Every entry the map earns, in one order, each one a file that exists. */
export function entryPoints(root) {
    const manifest = join(root, 'package.json');
    if (!existsSync(manifest)) {
        return [];
    }

    let exported;
    try {
        exported = JSON.parse(readFileSync(manifest, 'utf8')).exports;
    } catch {
        return [];
    }
    if (typeof exported !== 'object' || exported === null) {
        return [];
    }

    const entries = new Set();
    for (const [subpath, entry] of Object.entries(exported)) {
        if (subpath.includes('*')) {
            continue;
        }
        const source = sourceOf(targetOf(entry));
        if (source !== '' && existsSync(join(root, source))) {
            entries.add(source);
        }
    }

    return [...entries].toSorted((left, right) => left.localeCompare(right));
}

if (import.meta.main) {
    for (const entry of entryPoints(resolve(argv[2] ?? '.'))) {
        stdout.write(`${entry}\n`);
    }
}
