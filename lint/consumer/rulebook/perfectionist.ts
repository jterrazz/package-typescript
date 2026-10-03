import { createRequire } from 'node:module';

import { fragment, off, on } from '../../kit/compiler/decision.js';

// Only what oxfmt does not sort: measured on oxfmt 0.68, `sortImports` leaves named specifiers, unions,
// JSX attributes and heritage clauses alone. perfectionist resolves from this package, never the consumer's.

const require = createRequire(import.meta.url);

// `item2` before `item10`, which alphabetical order gets wrong.
const NATURAL = [{ type: 'natural' }];

export default fragment({
    id: 'perfectionist',
    audience: 'consumer',
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
