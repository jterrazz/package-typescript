import { defineConfig } from 'oxlint';

import { compose, node } from '@jterrazz/typescript/oxlint';

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
