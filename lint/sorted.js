import { createRequire } from 'node:module';

import { fragment, off, on } from './_contract.js';

/*
 * Sorting is formatting. oxfmt owns import order (`sortImports`), package.json
 * key order (`sortPackageJson`) and Tailwind class order (`sortTailwindcss`);
 * what is left is what oxfmt does not sort, and that is this fragment.
 *
 * Measured against oxfmt 0.68 on a fixture: `sortImports` reorders import
 * STATEMENTS and leaves the named specifiers inside one statement alone, and
 * it touches no type union, no JSX attribute and no heritage clause. Those
 * five are perfectionist's, and nothing else is.
 *
 * perfectionist reaches oxlint through the JS-plugin bridge, so the consumer
 * never declares it — `createRequire` resolves it from THIS package, where it
 * is a real dependency ([Developing](../docs/02-developing.md)).
 */

const require = createRequire(import.meta.url);

/** Natural order: `item2` before `item10`, which alphabetical order gets wrong. */
const NATURAL = [{ type: 'natural' }];

export default fragment({
    id: 'sorted',
    jsPlugins: [require.resolve('eslint-plugin-perfectionist')],
    rules: {
        'perfectionist/sort-heritage-clauses': on(NATURAL),
        'perfectionist/sort-intersection-types': on(NATURAL),
        'perfectionist/sort-jsx-props': on(NATURAL),
        'perfectionist/sort-named-exports': on(NATURAL),
        'perfectionist/sort-named-imports': on(NATURAL),
        'perfectionist/sort-union-types': on(NATURAL),

        'perfectionist/sort-imports': off({
            by: 'oxfmt sortImports — the formatter reorders import statements, and two tools rewriting the same bytes fight',
            kind: 'formatter',
        }),
    },
});
