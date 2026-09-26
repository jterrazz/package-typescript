import { existsSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

import { fragmentsIn, isRecord } from './module-walk.js';
import type { DeclaredFragment } from './module-walk.js';

const MODULE = /\.[cm]?js$/u;

type Walk = { executables: readonly string[]; walked: readonly string[] };

function modulesUnder(root: string, directory: string, executables: Set<string>): string[] {
    if (!existsSync(directory)) {
        return [];
    }
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) {
            return executables.has(relative(root, path))
                ? []
                : modulesUnder(root, path, executables);
        }
        return MODULE.test(entry.name) ? [relative(root, path)] : [];
    });
}

export async function lintFragments(
    root: string,
    { executables, walked }: Walk,
): Promise<DeclaredFragment[]> {
    const skipped = new Set(executables);
    const modules = walked.flatMap((folder) => modulesUnder(root, join(root, folder), skipped));
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
