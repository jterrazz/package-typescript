import { existsSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

import { fragmentsIn, isRecord } from './module-walk.js';
import type { DeclaredFragment } from './module-walk.js';

// These folders hold executables that act when imported, so the module walk imports them in children of their own.

const WALKED = ['lint', 'src'];
const EXECUTABLES = new Set([
    'lint/consumer/checks',
    'lint/engine/baseline',
    'lint/engine/project',
    'src/cli',
]);

const MODULE = /\.[cm]?js$/u;

function modulesUnder(root: string, directory: string): string[] {
    if (!existsSync(directory)) {
        return [];
    }
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) {
            return EXECUTABLES.has(relative(root, path)) ? [] : modulesUnder(root, path);
        }
        return MODULE.test(entry.name) ? [relative(root, path)] : [];
    });
}

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
