/**
 * The empty directories of a working copy — read off the disk, since git
 * tracks no directory and a sweep of what git lists can never see one.
 *
 * A directory is empty when it holds no file at any depth: one holding only
 * empty directories is empty too, and it is named once, at its top, since
 * deleting it deletes the rest. A directory holding a `.git` is a repository of
 * its own and is never entered, and neither is a folder no gate of the
 * toolchain reads (`node_modules/`, `.artifacts/`, `dist/` …) — a tool writes
 * there while the gates run. What git ignores is the machine's, and is left
 * alone; so is what an `--ignore-pattern` glob names.
 */

import { spawnSync } from 'node:child_process';
import { readdirSync, rmdirSync } from 'node:fs';
import { join, matchesGlob } from 'node:path';

import { UNSWEPT } from './project-files.js';

/** A directory holding one is a repository, a worktree or a submodule: never entered. */
const REPOSITORY_MARKER = '.git';

/** A glob naming what a directory holds — `data/**` — names the directory as well. */
const namedByGlob = (path, pattern) =>
    matchesGlob(path, pattern) || matchesGlob(`${path}/child`, pattern);

/**
 * Every empty directory under `root` at its top, relative to it and sorted —
 * `root` itself excepted, since a project that is empty is refused elsewhere.
 */
export function emptyDirectories(root, { ignorePatterns = [] } = {}) {
    const tops = [];

    /** Whether `relativePath` holds no file at any depth; its empty children join `tops` when it does. */
    function isEmpty(relativePath) {
        let entries;
        try {
            entries = readdirSync(join(root, relativePath), { withFileTypes: true });
        } catch {
            return false;
        }

        const emptyChildren = [];
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

/** The directories among `paths` git ignores, or none where `root` is in no repository. */
function ignoredByGit(root, paths) {
    if (paths.length === 0) {
        return new Set();
    }
    const { status, stdout } = spawnSync('git', ['check-ignore', '--stdin', '-z'], {
        cwd: root,
        encoding: 'utf8',
        input: paths.map((path) => `${path}/`).join('\0'),
        stdio: ['pipe', 'pipe', 'ignore'],
    });
    if (status !== 0) {
        return new Set();
    }

    return new Set(
        stdout
            .split('\0')
            .filter((path) => path !== '')
            .map((path) => path.replace(/\/$/u, '')),
    );
}

/**
 * Delete one empty directory, bottom-up, one `rmdir` at a time — so a file
 * that landed in it since it was read stops the deletion rather than going
 * with it. Whether the whole directory went.
 */
export function removeEmptyDirectory(root, relativePath) {
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
