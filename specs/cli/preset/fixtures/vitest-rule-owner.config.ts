import { defineConfig } from 'oxlint';

import { compose, node } from '@jterrazz/typescript/oxlint';

/*
 * ADR-008's second owner, stood in. `@jterrazz/test` 16.0's `testing`
 * fragment sets `vitest/no-restricted-matchers` (among others) WITH the
 * option this vocabulary owns, scoped over the same test globs, and composes
 * AFTER this profile — this suite cannot depend on that fragment before its
 * own 16.0 ships, so the override below carries the one option under test and
 * nothing else. What is proved here is this package's own contract (a later
 * override wins), not `@jterrazz/test`'s fragment, which answers for itself.
 */
const owner = {
    overrides: [
        {
            files: ['**/*.test.ts'],
            rules: {
                'vitest/no-restricted-matchers': [
                    'error',
                    { toMatchSnapshot: 'compare the golden with `toStrictEqual` instead' },
                ],
            },
        },
    ],
};

export default defineConfig(compose(node, owner));
