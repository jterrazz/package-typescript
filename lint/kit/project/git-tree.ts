import { lstatSync, readdirSync, renameSync, statSync } from 'node:fs';
import { basename, dirname, join, resolve, sep } from 'node:path';

import { git } from './git.js';

export type TreeEntry = {
    isDirectory: () => boolean;
    isFile: () => boolean;
    isSymbolicLink: () => boolean;
    name: string;
};

type WorkTree = {
    children: Map<string, Set<string>>;
    index: string;
    listedAt: number;
    top: string;
};

// Stryker disable next-line ArrayDeclaration: a stand-in entry holds no top, and a directory is under no top that reads undefined
const trees: WorkTree[] = [];
const outsideWorkTrees = new Set<string>();

function under(dir: string, root: string): boolean {
    return dir === root || dir.startsWith(`${root}${sep}`);
}

export function listNotIgnored(top: string): null | string[] {
    return (
        git(top, ['ls-files', '--cached', '--others', '--exclude-standard', '-z'])?.split('\0') ??
        null
    );
}

function indexOf(top: string, paths: string[], index: string, listedAt: number): WorkTree {
    const children = new Map<string, Set<string>>();
    for (const path of paths) {
        // outside: an untracked nested repository is listed as `sub/`: the trailing
        // separator names no child.
        const segments = path.split('/').filter((segment) => segment !== '');
        let parent = top;
        for (const segment of segments) {
            let names = children.get(parent);
            if (names === undefined) {
                names = new Set();
                children.set(parent, names);
            }
            names.add(segment);
            parent = join(parent, segment);
        }
    }
    return { children, index, listedAt, top };
}

function changedAt(path: string): number {
    return statSync(path, { throwIfNoEntry: false })?.mtimeMs ?? 0;
}

function isListingStale(tree: WorkTree, dir: string): boolean {
    return changedAt(tree.index) >= tree.listedAt || changedAt(dir) >= tree.listedAt;
}

function listTree(top: string, index: string): null | WorkTree {
    const listedAt = Date.now();
    const paths = listNotIgnored(top);
    return paths === null ? null : indexOf(top, paths, index, listedAt);
}

function locate(dir: string): null | { index: string; top: string } {
    const located = git(dir, ['rev-parse', '--show-cdup', '--git-path', 'index']);
    if (located === undefined) {
        return null;
    }
    // outside: `--show-cdup` prints an empty line at the top level: the two answers are
    // read by position, never trimmed together.
    const [cdup = '', index = ''] = located.split('\n');

    return { index: resolve(dir, index), top: resolve(dir, cdup) };
}

function inDependency(path: string): boolean {
    return path.split(sep).includes('node_modules');
}

function workTreeOf(dir: string, read: string): null | WorkTree {
    if (inDependency(dir)) {
        return null;
    }
    const at = trees.findIndex(({ top }) => under(dir, top));
    const known = trees[at];
    if (known !== undefined) {
        if (!isListingStale(known, read)) {
            return known;
        }
        const relisted = listTree(known.top, known.index);
        if (relisted === null) {
            trees.splice(at, 1);
            return null;
        }
        trees[at] = relisted;
        return relisted;
    }
    if ([...outsideWorkTrees].some((root) => under(dir, root))) {
        return null;
    }
    const located = locate(dir);
    const tree = located === null ? null : listTree(located.top, located.index);
    if (tree === null) {
        outsideWorkTrees.add(dir);
        return null;
    }
    trees.push(tree);
    return tree;
}

function entryOf(dir: string, name: string): null | TreeEntry {
    let stats;
    try {
        stats = lstatSync(join(dir, name));
    } catch {
        return null;
    }
    return {
        isDirectory: () => stats.isDirectory(),
        isFile: () => stats.isFile(),
        isSymbolicLink: () => stats.isSymbolicLink(),
        name,
    };
}

/** The children git does not ignore inside a work tree, every child elsewhere; throws where `readdirSync` throws. */
export function treeEntries(dir: string): TreeEntry[] {
    const absolute = resolve(dir);
    const onDisk = readdirSync(absolute, { withFileTypes: true });
    const tree = workTreeOf(absolute, absolute);
    if (tree === null) {
        return onDisk;
    }
    const names = tree.children.get(absolute) ?? new Set<string>();
    return [...names]
        .map((name) => entryOf(absolute, name))
        .filter((entry): entry is TreeEntry => entry !== null);
}

export function treeNames(dir: string): string[] {
    return treeEntries(dir).map(({ name }) => name);
}

/** Changes exactly when a listing of `dir` would answer differently: the git index and the directory mtime. */
export function treeStamp(dir: string): string {
    const absolute = resolve(dir);
    const tree = workTreeOf(absolute, absolute);
    const index = tree === null ? 0 : changedAt(tree.index);
    return `${index}:${changedAt(absolute)}`;
}

export function treeKind(path: string): 'directory' | 'file' | undefined {
    const absolute = resolve(path);
    let directory: boolean;
    try {
        directory = statSync(absolute).isDirectory();
    } catch {
        return undefined;
    }
    const kind = directory ? 'directory' : 'file';
    const tree = workTreeOf(directory ? absolute : dirname(absolute), dirname(absolute));
    if (tree === null) {
        return kind;
    }
    const listed =
        absolute === tree.top ||
        (tree.children.get(dirname(absolute))?.has(basename(absolute)) ?? false);
    return listed ? kind : undefined;
}

export function forgetTree(): void {
    trees.length = 0;
    outsideWorkTrees.clear();
}

export function moveKeepingHistory(from: string, to: string): void {
    if (git(dirname(from), ['mv', from, to]) === undefined) {
        renameSync(from, to);
    }
    forgetTree();
}
