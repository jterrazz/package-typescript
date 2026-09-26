// A member is a directory matching a glob AND holding a package.json, as the package managers rule.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

const SKIPPED = new Set(['dist', 'node_modules']);

function toPattern(glob) {
    const escaped = glob
        .replaceAll(/[.+^${}()|[\]\\]/gu, String.raw`\$&`)
        .replaceAll('**', ' ')
        .replaceAll('*', '[^/]*')
        .replaceAll(' ', '.*');

    return new RegExp(`^${escaped}$`, 'u');
}

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

// Empty for a single-package project, which every caller reads as "the root is the unit".
export function workspaceMembers(root = '.') {
    const absolute = resolve(root);
    const patterns = declaredGlobs(absolute)
        .filter((glob) => typeof glob === 'string' && !glob.startsWith('!'))
        .map((glob) => toPattern(glob.replace(/\/+$/u, '')));

    if (patterns.length === 0) {
        return [];
    }

    const members = new Set();

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
