import { GROUND_GLOBS } from './ground.js';
import { objectOf } from './json.js';

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

/** The folders `typescript.roots` declares `verbatim`: kept as written by every pass that reads or rewrites a file, quoted upstream text, signed articles, a script's output. */
export function verbatimTreesOf(typescript: unknown): string[] {
    return Object.entries(objectOf(objectOf(typescript).roots))
        .filter(([, declaration]) => objectOf(declaration).verbatim === true)
        .map(([root]) => asTree(root));
}

/** The paths no gesture of `fix` rewrites in a unit, given its resolved `typescript` section: the content trees, the ground of its tests, what it hands the formatter to leave alone, and the roots declared verbatim. */
export function keptByteForByte(typescript: unknown): string[] {
    const { oxfmt } = objectOf(typescript);

    return [
        ...CONTENT_TREES,
        ...GROUND_GLOBS,
        ...Object.keys(objectOf(objectOf(oxfmt).ignore)).map(asTree),
        ...verbatimTreesOf(typescript),
    ];
}
