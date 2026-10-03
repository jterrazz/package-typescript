import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { isFile } from './fs-cache.js';

export function isRepositoryRoot(dir: string): boolean {
    // outside: `.git` is a directory in a clone and a file in a worktree.
    return existsSync(join(dir, '.git'));
}

export const holdsManifest = (directory: string): boolean =>
    isFile(join(directory, 'package.json'));

export const isProjectRoot = (directory: string): boolean =>
    holdsManifest(directory) || isRepositoryRoot(directory);

export function nearestRoot(
    from: string,
    isRoot: (directory: string) => boolean,
): string | undefined {
    let directory = from;
    while (!isRoot(directory)) {
        const parent = dirname(directory);
        if (parent === directory) {
            return undefined;
        }
        directory = parent;
    }

    return directory;
}
