import { fragment, off, on, scoped } from '../../../kit/compiler/decision.js';
import { IMPORT_ASSETS } from '../import.js';

// outside: oxlint parses an `.astro` file's script body but not its frontmatter as a module, so these decisions are scoped to `*.astro`.
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
        // outside: Vite resolves an asset by its extension, and Astro's `resolve.extensions` does not carry `.astro`.
        'import/extensions': on(['never', { ...IMPORT_ASSETS, astro: 'always' }]),
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
                        // Stryker disable next-line StringLiteral: oxlint reads the rulebook in a process of its own, which no mutant reaches; the behaviour grounds of specs/cli/preset/ prove each name
                        message: 'this is an Astro site, where the Next runtime does not run',
                    },
                ],
            },
        ]),
    },
});
