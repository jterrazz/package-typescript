import { fragment, off, on, scoped } from './_contract.js';
import { ASSETS } from './core/import.js';

/*
 * Astro. oxlint parses an `.astro` file's script body but not its frontmatter
 * as a module, so the three decisions below are scoped to `*.astro` alone;
 * everything else in an Astro tree is ordinary TypeScript under the core
 * rulebook.
 *
 * The restricted imports are the boundary five checkouts hand-copied before
 * this fragment existed: an Astro site is not a Next site, and reaching for
 * Next's router or its intl package is the mistake that keeps being made.
 */
export default fragment({
    id: 'astro',
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
        /*
         * `never`, with two extensions that stay: an asset, which Vite resolves
         * BY its extension, and `.astro` itself — Astro's `resolve.extensions`
         * does not carry it, so a layout imported without it fails the build.
         * An override's options REPLACE the base entry, so the whole list is
         * restated here.
         */
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
