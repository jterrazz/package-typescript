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

// invariant: a glob stands as written, a path with an extension names a file and stands as written, and any other path is a folder, widened to its whole tree.
const asTree = (path: string): string =>
    /[*?[{]/u.test(path) || /\.[A-Za-z0-9]+$/u.test(path.split('/').at(-1) ?? '')
        ? path
        : `${path}/**`;

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
    verbatimRootsOf(typescript).map(asTree);

/** The paths no gesture of `fix` rewrites in a unit, given its resolved `typescript` section: the content trees, the ground of its tests, what it hands the formatter to leave alone, and the roots declared verbatim. */
export function keptByteForByte(typescript: unknown): string[] {
    const { oxfmt } = objectOf(typescript);

    const handedToTheFormatter = Object.keys(objectOf(objectOf(oxfmt).ignore));
    const kept = [
        ...CONTENT_TREES,
        ...GROUND_GLOBS,
        ...handedToTheFormatter.map(asTree),
        ...verbatimTreesOf(typescript),
    ];

    return [...new Set(kept)];
}
