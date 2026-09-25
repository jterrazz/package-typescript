import { existsSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

import { fragmentsIn, isRecord } from './module-walk.js';
import type { DeclaredFragment } from './module-walk.js';

/*
 * The fragment-walk rule: every fragment a package tree declares, whether a
 * profile carries it or not — each one a module of `lint/` or `src/` holds
 * anywhere in what it exports, by default or by name, in a `.js`, `.mjs` or
 * `.cjs` module. `src/cli/` holds the executables `bin/` runs, which act when
 * imported, so the walk leaves it to the module walk, which imports each module in a child of its own (`module-walk.ts`). The tree is
 * this checkout's or a packed one, named by its package root.
 */

/** The folders the walk imports from, and the one it never imports. */
const WALKED = ['lint', 'src'];
const EXECUTABLES = 'src/cli';

/** A module Node loads, in either module system. */
const MODULE = /\.[cm]?js$/u;

/** Every module under `directory`, as a path from `root`, the executables left out. */
function modulesUnder(root: string, directory: string): string[] {
    if (!existsSync(directory)) {
        return [];
    }
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) {
            return relative(root, path) === EXECUTABLES ? [] : modulesUnder(root, path);
        }
        return MODULE.test(entry.name) ? [relative(root, path)] : [];
    });
}

/** The fragments the tree under `root` declares, each module imported once. */
export async function lintFragments(root: string): Promise<DeclaredFragment[]> {
    const modules = WALKED.flatMap((folder) => modulesUnder(root, join(root, folder)));
    const seen = new Set<unknown>();
    const loaded = await Promise.all(
        modules.map(async (path) => ({
            exported: (await import(pathToFileURL(join(root, path)).href)) as unknown,
            path,
        })),
    );

    return loaded.flatMap(({ exported, path }) =>
        isRecord(exported)
            ? Object.entries(exported).flatMap(([name, value]) =>
                  fragmentsIn(value, `${path}#${name}`, seen),
              )
            : [],
    );
}
