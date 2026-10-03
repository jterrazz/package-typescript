import { dirname, join, resolve } from 'node:path';

import type { Context } from '../../kit/checker/pass.js';
import { parsedObject } from '../../kit/project/json.js';
import { isRepositoryRoot } from '../../kit/project/repository-root.js';

export type Disk = Pick<Context, 'exists' | 'read'>;

const NEXT_CONFIG_FILES = [
    'next.config.js',
    'next.config.mjs',
    'next.config.ts',
    'next.config.mts',
    'next.config.cjs',
    'next.config.cts',
];

// outside: with `output: 'export'`, Next keeps its working directory at `.next` whatever `distDir` says
// (`next/dist/export/utils.js`, `hasCustomExportOutput`). Read as text: a config may not load here.
// An unreadable config answers as a missing one does.
export function nextConfigDeclaresExport(disk: Disk, dir: string): boolean {
    return NEXT_CONFIG_FILES.some((name) =>
        /output\s*:\s*['"]export['"]/u.test(disk.read(join(dir, name)) ?? ''),
    );
}

const WORKSPACE_LOCKFILES = [
    'bun.lock',
    'bun.lockb',
    'npm-shrinkwrap.json',
    'package-lock.json',
    'pnpm-lock.yaml',
    'yarn.lock',
];

function isWorkspaceRoot(disk: Disk, dir: string): boolean {
    if (WORKSPACE_LOCKFILES.some((name) => disk.exists(join(dir, name)))) {
        return true;
    }

    const manifest = disk.read(join(dir, 'package.json'));
    if (manifest === null) {
        return false;
    }

    try {
        return parsedObject(manifest).workspaces !== undefined;
    } catch {
        return false;
    }
}

// invariant: never passes the nearest repository boundary, so a `root` with its own `.git` has no ancestor.
export function findWorkspaceRoot(disk: Disk, root: string): null | string {
    const start = resolve(root);
    if (isRepositoryRoot(start)) {
        return null;
    }

    let dir = dirname(start);
    let parent = dirname(dir);

    while (dir !== parent) {
        if (isWorkspaceRoot(disk, dir)) {
            return dir;
        }
        if (isRepositoryRoot(dir)) {
            return null;
        }
        dir = parent;
        parent = dirname(dir);
    }

    return isWorkspaceRoot(disk, dir) ? dir : null;
}
