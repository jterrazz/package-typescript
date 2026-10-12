import { statSync } from 'node:fs';
import type { Stats } from 'node:fs';
import { join } from 'node:path';

import { GROUND_GLOBS } from './ground.js';
import { objectOf, stringsOf } from './json.js';

// hazard: a content tree can hold signed bytes — jterrazz-web's attested articles under assets/ — that one rewrite would invalidate.
const CONTENT_TREES: readonly string[] = Object.freeze([
    'dist/**',
    'assets/**',
    'public/**',
    '.next/**',
    '.expo/**',
]);

const GLOB = /[*?[{]/u;

// invariant: a glob stands as written; a root is always a folder, widened to its whole tree, whatever its name ends in.
const treeOf = (path: string): string => (GLOB.test(path) ? path : `${path}/**`);

// invariant: the disk decides what a path names, never its spelling — a file stands as written, a folder is widened to its tree, so `.claude` and `docs/v1.2` are folders and `Makefile` is a file; only a path the disk does not hold (or a read with no unit to look in) is guessed, a last name carrying an extension being a file.
function asTree(path: string, unitRoot: string | undefined): string {
    if (GLOB.test(path)) {
        return path;
    }
    const onDisk = unitRoot === undefined ? undefined : statOf(join(unitRoot, path));

    return (onDisk?.isFile() ?? /\.[A-Za-z0-9]+$/u.test(path)) ? path : `${path}/**`;
}

const statOf = (path: string): Stats | undefined => statSync(path, { throwIfNoEntry: false });

/** The root folders kept as written: the ones `typescript.roots` declares `verbatim`, then the platform's tool roots its standard names verbatim (`public/`, an app's `assets/`). */
export function verbatimRootsOf(typescript: unknown): string[] {
    const { roots, verbatimToolRoots } = objectOf(typescript);
    const declared = Object.entries(objectOf(roots))
        .filter(([, declaration]) => objectOf(declaration).verbatim === true)
        .map(([root]) => root);

    return [...new Set([...declared, ...stringsOf(verbatimToolRoots)])];
}

/** The trees of those roots: kept as written by every pass that reads or rewrites a file, quoted upstream text, signed articles, a script's output, the files a platform's tool serves. */
export const verbatimTreesOf = (typescript: unknown): string[] =>
    verbatimRootsOf(typescript).map(treeOf);

/** The paths no gesture of `fix` rewrites in a unit, given its resolved `typescript` section: the content trees, the ground of its tests, what it hands the formatter to leave alone, and the roots declared verbatim. */
export function keptByteForByte(typescript: unknown, unitRoot?: string): string[] {
    const { oxfmt } = objectOf(typescript);

    const handedToTheFormatter = Object.keys(objectOf(objectOf(oxfmt).ignore));
    const kept = [
        ...CONTENT_TREES,
        ...GROUND_GLOBS,
        ...handedToTheFormatter.map((path) => asTree(path, unitRoot)),
        ...verbatimTreesOf(typescript),
    ];

    return [...new Set(kept)];
}
