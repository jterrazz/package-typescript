import { fragment, off, on, scoped } from '../../../engine/rulebook/decision.js';
import { ASSETS } from '../import.js';

// oxlint parses an `.astro` file's script body but not its frontmatter as a module, so these decisions are scoped to `*.astro`.
export default fragment({
    id: 'frameworks/astro',
    audience: 'consumer',
    ignorePatterns: ['.astro/**', 'assets/**', 'public/**'],
    overrides: [
        scoped({
            files: ['**/*.astro'],
            rules: {
                'import/no-commonjs': on(),
                'no-restricted-globals': on(['__dirname', '__filename']),
                'unicorn/prefer-module': off({
                    by: 'an .astro frontmatter block is not a module body, so the rule reads the file wrong',
                    kind: 'convention',
                }),
            },
        }),
    ],
    rules: {
        // Vite resolves an asset by its extension, and Astro's `resolve.extensions` does not carry `.astro`.
        'import/extensions': on(['never', { ...ASSETS, astro: 'always' }]),
        'no-restricted-imports': on([
            {
                patterns: [
                    {
                        group: [
                            'next',
                            'next/*',
                            'next-intl',
                            'next-intl/*',
                            '@jterrazz/manifest/next',
                        ],
                        message: 'this is an Astro site — the Next runtime is not on it',
                    },
                ],
            },
        ]),
    },
});
