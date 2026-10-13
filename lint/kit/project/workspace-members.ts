// outside: a member is a directory matching a glob AND holding a package.json, as the package managers rule.

import { readdirSync, readFileSync } from 'node:fs';
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

    // Stryker disable next-line StringLiteral: every character the pattern holds that the unicode flag reads otherwise is escaped, and a path is ASCII
    return new RegExp(`^${escaped}$`, 'u');
}

// outside: pnpm declares its members in `pnpm-workspace.yaml`, a `packages:` list of globs, and keeps no `workspaces` field in the manifest.
export function pnpmWorkspacePatterns(root: string): string[] {
    let text: string;
    try {
        text = readFileSync(join(root, 'pnpm-workspace.yaml'), 'utf8');
    } catch {
        return [];
    }
    const lines = text.split('\n');
    const start = lines.findIndex((line) => /^packages:\s*(?:#.*)?$/u.test(line));
    if (start === -1) {
        return [];
    }
    const listed: string[] = [];
    for (const line of lines.slice(start + 1)) {
        // Stryker disable next-line OptionalChaining: a chain whose first link is null stops there, so the second link is never asked
        const item = /^\s+-\s+(?<quote>['"]?)(?<glob>.+?)\k<quote>\s*(?:#.*)?$/u.exec(line)?.groups
            ?.glob;
        if (item !== undefined) {
            listed.push(item);
        } else if (/^\S/u.test(line)) {
            break;
        }
    }

    return listed;
}

// invariant: empty for a single-package project, which every caller reads as "the root is the unit".
// Stryker disable next-line StringLiteral: resolve reads an empty root as the working folder, as it reads a dot
export function workspaceMembers(root = '.'): string[] {
    const absolute = resolve(root);
    const manifest = readManifest(absolute);
    const declared = manifest === null ? [] : workspacePatterns(manifest);
    const listed = declared.length > 0 ? declared : pnpmWorkspacePatterns(absolute);
    // Stryker disable next-line MethodExpression: a negated glob read as a pattern opens on `!`, which no path does, so it matches nothing whether it is dropped or kept
    const included = listed.filter((glob) => !glob.startsWith('!'));
    const patterns = included.map((glob) => toPattern(glob.replace(/\/+$/u, '')));

    // Stryker disable next-line ConditionalExpression,BlockStatement: with no pattern no folder matches, so the walk finds none; the guard only spares reading the tree
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

            if (patterns.some((pattern) => pattern.test(path)) && readManifest(child) !== null) {
                members.add(path);
                continue;
            }

            walk(child, depth + 1);
        }
    }

    walk(absolute, 0);

    return [...members].toSorted();
}
