import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { treeKind } from './git-tree.js';
import { isJsonObject } from './json.js';
import type { JsonObject } from './json.js';

export const MEMBER_DEPTH = 6;

export type Manifest = JsonObject & {
    dependencies?: Readonly<Record<string, string>>;
    devDependencies?: Readonly<Record<string, string>>;
    exports?: unknown;
    name?: string;
    scripts?: Readonly<Record<string, string>>;
    workspaces?: unknown;
};

/** No manifest, a folder by that name, one git ignores, and a file that is no JSON object all read as none. */
export function readManifest(dir: string): Manifest | null {
    if (treeKind(join(dir, 'package.json')) !== 'file') {
        return null;
    }
    try {
        // Stryker disable next-line StringLiteral: JSON.parse reads a Buffer as its UTF-8 text, so the encoding only names the type
        const parsed: unknown = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));

        return isJsonObject(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

/** The packages a unit's manifest declares, as dependencies or devDependencies; none when it has no manifest. */
export function declaredDependencies(dir: string): ReadonlySet<string> {
    const manifest = readManifest(dir);

    return new Set([
        ...Object.keys(manifest?.dependencies ?? {}),
        ...Object.keys(manifest?.devDependencies ?? {}),
    ]);
}

export function workspacePatterns(manifest: Manifest): string[] {
    const { workspaces } = manifest;
    const declared = isJsonObject(workspaces) ? workspaces.packages : workspaces;

    return Array.isArray(declared)
        ? declared.filter((glob): glob is string => typeof glob === 'string')
        : [];
}

// invariant: a package's published subpaths, `<name>/<subpath>`, read from the first manifest above `from`: naming another package, the walk has left its tree.
export function declaredSubpaths(name: string, from: string): string[] {
    let dir = from;
    for (;;) {
        const manifest = readManifest(dir);
        if (manifest !== null) {
            const { exports } = manifest;

            return manifest.name === name && isJsonObject(exports)
                ? Object.keys(exports)
                      .filter((key) => key.startsWith('./'))
                      .map((key) => `${name}/${key.slice(2)}`)
                      .toSorted()
                : [];
        }
        const parent = join(dir, '..');
        if (parent === dir) {
            return [];
        }
        dir = parent;
    }
}
