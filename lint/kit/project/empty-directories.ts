// outside: read off the disk: git tracks no directory, so a sweep of what git lists can never see one.

import { readdirSync, rmdirSync } from 'node:fs';
import type { Dirent } from 'node:fs';
import { join, matchesGlob } from 'node:path';

import { git } from './git.js';
import { UNSWEPT } from './project-files.js';

// invariant: a repository, a worktree or a submodule: never entered.
const REPOSITORY_MARKER = '.git';

const namedByGlob = (path: string, pattern: string): boolean =>
    matchesGlob(path, pattern) || matchesGlob(`${path}/child`, pattern);

// invariant: `root` itself excepted: a project that is empty is refused elsewhere.
export function emptyDirectories(
    root: string,
    { ignorePatterns = [] }: { ignorePatterns?: readonly string[] } = {},
): string[] {
    const tops: string[] = [];

    function isEmpty(relativePath: string): boolean {
        let entries: Dirent[];
        try {
            entries = readdirSync(join(root, relativePath), { withFileTypes: true });
        } catch {
            return false;
        }

        const emptyChildren: string[] = [];
        let holdsAFile = false;
        for (const entry of entries) {
            const child = relativePath === '' ? entry.name : `${relativePath}/${entry.name}`;
            if (
                entry.name === REPOSITORY_MARKER ||
                UNSWEPT.has(entry.name) ||
                !entry.isDirectory()
            ) {
                holdsAFile = true;
            } else if (isEmpty(child)) {
                emptyChildren.push(child);
            } else {
                holdsAFile = true;
            }
        }

        if (holdsAFile || relativePath === '') {
            tops.push(...emptyChildren);
        }

        return !holdsAFile;
    }

    isEmpty('');

    const named = tops.filter(
        (path) => !ignorePatterns.some((pattern) => namedByGlob(path, pattern)),
    );
    const ignored = ignoredByGit(root, named);

    return named
        .filter((path) => !ignored.has(path))
        .toSorted((left, right) => (left < right ? -1 : 1));
}

function ignoredByGit(root: string, paths: readonly string[]): ReadonlySet<string> {
    if (paths.length === 0) {
        return new Set();
    }
    const stdout = git(
        root,
        ['check-ignore', '--stdin', '-z'],
        paths.map((path) => `${path}/`).join('\0'),
    );
    if (stdout === undefined) {
        return new Set();
    }

    return new Set(
        stdout
            .split('\0')
            .filter((path) => path !== '')
            .map((path) => path.replace(/\/$/u, '')),
    );
}

// hazard: one `rmdir` at a time, bottom-up, so a file that landed since it was read stops the deletion.
export function removeEmptyDirectory(root: string, relativePath: string): boolean {
    const path = join(root, relativePath);
    try {
        for (const entry of readdirSync(path, { withFileTypes: true })) {
            if (entry.isDirectory()) {
                removeEmptyDirectory(root, `${relativePath}/${entry.name}`);
            }
        }
        rmdirSync(path);

        return true;
    } catch {
        return false;
    }
}
