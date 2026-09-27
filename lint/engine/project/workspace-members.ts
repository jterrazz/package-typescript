// A member is a directory matching a glob AND holding a package.json, as the package managers rule.

import { existsSync, readdirSync } from 'node:fs';
import type { Dirent } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

import { MEMBER_DEPTH, readManifest, workspacePatterns } from './manifest.js';

const SKIPPED = new Set(['dist', 'node_modules']);

function toPattern(glob: string): RegExp {
    const escaped = glob
        .replaceAll(/[.+^${}()|[\]\\]/gu, String.raw`\$&`)
        .replaceAll('**', ' ')
        .replaceAll('*', '[^/]*')
        .replaceAll(' ', '.*');

    return new RegExp(`^${escaped}$`, 'u');
}

// Empty for a single-package project, which every caller reads as "the root is the unit".
export function workspaceMembers(root = '.'): string[] {
    const absolute = resolve(root);
    const manifest = readManifest(absolute);
    const patterns = (manifest === null ? [] : workspacePatterns(manifest))
        .filter((glob) => !glob.startsWith('!'))
        .map((glob) => toPattern(glob.replace(/\/+$/u, '')));

    if (patterns.length === 0) {
        return [];
    }

    const members = new Set<string>();

    function walk(dir: string, depth: number): void {
        if (depth > MEMBER_DEPTH) {
            return;
        }

        let entries: Dirent[];
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
