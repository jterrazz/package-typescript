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

const asTree = (path: string): string => (/[*?[{]/u.test(path) ? path : `${path}/**`);

/** The paths no gesture of `fix` rewrites in a unit, given its resolved `typescript` section: the content trees, the ground of its tests, what it hands the formatter to leave alone, and the roots a script writes. */
export function keptByteForByte(typescript: unknown): string[] {
    const { generated, oxfmt } = objectOf(typescript);

    return [
        ...CONTENT_TREES,
        ...GROUND_GLOBS,
        ...Object.keys(objectOf(objectOf(oxfmt).ignore)).map(asTree),
        ...Object.keys(objectOf(generated)).map(asTree),
    ];
}
