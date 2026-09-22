#!/usr/bin/env node

/**
 * The workspace members declared by a package.json — the unit every
 * per-package gate measures from.
 *
 * As a module: `workspaceMembers(root)` returns the member directories,
 * relative to the root, no trailing slash, sorted. As a CLI, the same list on
 * stdout, one per line:
 *
 *     node workspace-members.js [root]
 *
 * The toolchain's unit is the workspace PACKAGE, not the repository: a gate
 * that reads `specs/` or `docs/` at cwd sees only the root's, and a monorepo's
 * members are silently never checked. Callers ask here what the members are;
 * the list is empty when the package declares no `workspaces`, and the caller
 * falls back to the root itself.
 *
 * Supported declarations (the npm/yarn/bun surface):
 *   "workspaces": ["apps/*", "packages/*"]
 *   "workspaces": { "packages": ["apps/*"] }        // yarn classic
 *
 * A member is a directory matching a glob AND holding a package.json — the
 * same rule the package managers apply. Globs support `*` (one segment) and
 * `**` (any depth); `node_modules`, `dist` and dot-directories are never
 * descended into.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { argv, stdout } from 'node:process';

const SKIPPED = new Set(['dist', 'node_modules']);

/** A glob over path segments — `*` stops at a separator, `**` does not. */
function toPattern(glob) {
    const escaped = glob
        .replaceAll(/[.+^${}()|[\]\\]/gu, String.raw`\$&`)
        .replaceAll('**', ' ')
        .replaceAll('*', '[^/]*')
        .replaceAll(' ', '.*');

    return new RegExp(`^${escaped}$`, 'u');
}

/** The `workspaces` globs of a package.json, in either declared form. */
function declaredGlobs(root) {
    const manifest = join(root, 'package.json');
    if (!existsSync(manifest)) {
        return [];
    }

    let declared;
    try {
        const pkg = JSON.parse(readFileSync(manifest, 'utf8'));
        declared = Array.isArray(pkg.workspaces) ? pkg.workspaces : pkg.workspaces?.packages;
    } catch {
        return [];
    }

    return Array.isArray(declared) ? declared : [];
}

/**
 * The member directories of the workspace rooted at `root` — empty for a
 * single-package project, which every caller reads as "the root is the unit".
 */
export function workspaceMembers(root = '.') {
    const absolute = resolve(root);
    const patterns = declaredGlobs(absolute)
        .filter((glob) => typeof glob === 'string' && !glob.startsWith('!'))
        .map((glob) => toPattern(glob.replace(/\/+$/u, '')));

    if (patterns.length === 0) {
        return [];
    }

    const members = new Set();

    /** Walk the tree once, keeping every directory a pattern claims as a package. */
    function walk(dir, depth) {
        if (depth > 6) {
            return;
        }

        let entries;
        try {
            entries = readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }

        for (const entry of entries) {
            if (!entry.isDirectory() || entry.name.startsWith('.') || SKIPPED.has(entry.name)) {
                continue;
            }

            const child = join(dir, entry.name);
            const path = relative(absolute, child).split(sep).join('/');

            if (
                patterns.some((pattern) => pattern.test(path)) &&
                existsSync(join(child, 'package.json'))
            ) {
                members.add(path);
                continue;
            }

            walk(child, depth + 1);
        }
    }

    walk(absolute, 0);

    return [...members].toSorted((left, right) => (left < right ? -1 : 1));
}

// CLI form — only when this file IS the process entry, never on import.
if (argv[1] && resolve(argv[1]) === import.meta.filename) {
    const members = workspaceMembers(argv[2] ?? '.');
    if (members.length > 0) {
        stdout.write(`${members.join('\n')}\n`);
    }
}
