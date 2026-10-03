import { readFileSync, statSync } from 'node:fs';

import { forgetTree, treeKind, treeNames, treeStamp } from './git-tree.js';

/** Nothing is kept past the moment it could change: the editor's host keeps this module loaded across lint runs, and oxlint marks no run boundary a plugin can see. */

export function listDirectory(dir: string): null | string[] {
    try {
        return treeNames(dir);
    } catch {
        return null;
    }
}

export function isDirectory(path: string): boolean {
    return treeKind(path) === 'directory';
}

export function isFile(path: string): boolean {
    return treeKind(path) === 'file';
}

/** For `.git`, which git never lists. */
export function isOnDisk(path: string): boolean {
    try {
        statSync(path);
        return true;
    } catch {
        return false;
    }
}

type Read = { changedAt: number; text: null | string };

const fileContents = new Map<string, Read>();

export function readFileCached(path: string): null | string {
    if (!isFile(path)) {
        return null;
    }
    const changedAt = statSync(path, { throwIfNoEntry: false })?.mtimeMs ?? 0;
    const cached = fileContents.get(path);
    if (cached?.changedAt === changedAt) {
        return cached.text;
    }
    let text: null | string;
    try {
        text = readFileSync(path, 'utf8');
    } catch {
        text = null;
    }
    fileContents.set(path, { changedAt, text });
    return text;
}

const folderStamps = new Map<string, string>();

export function folderChanged(folder: string): boolean {
    const stamp = treeStamp(folder);
    const previous = folderStamps.get(folder);
    folderStamps.set(folder, stamp);
    return previous !== undefined && previous !== stamp;
}

export function resetFsCache(): void {
    fileContents.clear();
    folderStamps.clear();
    forgetTree();
}
