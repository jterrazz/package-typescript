import { defineConfig } from 'oxfmt';

/*
 * The formatting decisions, in one place. Four of them are the estate's and do
 * not move — 100 columns, 4 spaces, single quotes, trailing commas everywhere —
 * because twenty-eight repositories are written that way and two of them hold
 * signed attestation bytes a reflow would invalidate.
 *
 * The three sorters are the fourth law of the rulebook: sorting is formatting.
 * oxfmt owns import order, package.json key order and Tailwind class order, so
 * no lint rule reorders those bytes and no two tools fight over them
 * ([Lint presets](../../../docs/07-lint-presets.md)).
 */
export default defineConfig({
    bracketSpacing: true,
    endOfLine: 'lf',
    printWidth: 100,
    semi: true,
    singleQuote: true,
    /* The grouping the estate has read for three years: builtins and externals
     * together at the top, then internals, then the relative block, then
     * styles. A blank line between groups, case-insensitive inside one. */
    sortImports: {
        groups: [
            ['builtin', 'external'],
            ['internal', 'subpath'],
            ['parent', 'sibling', 'index'],
            'style',
            'unknown',
        ],
        ignoreCase: true,
        newlinesBetween: true,
        order: 'asc',
    },
    sortPackageJson: true,
    /* Tailwind's own order, on `class`/`className` and on the class-holding
     * helpers every repo of the estate uses. Regex matchers are not supported
     * yet — these are exact names. */
    sortTailwindcss: {
        functions: ['clsx', 'cn', 'cva', 'tv', 'twMerge', 'twJoin', 'tw'],
    },
    tabWidth: 4,
    trailingComma: 'all',
    useTabs: false,
    /* Asset trees and build caches are not source — and a content tree
     * can hold signed bytes (jterrazz-web's attestations), where one formatter
     * pass invalidates every proof. */
    ignorePatterns: [
        'dist/**',
        'assets/**',
        'public/**',
        '.next/**',
        '.expo/**',
        // A spec's ground is deliberately mis-shaped or held byte for byte;
        // formatting any of it would rewrite the claim.
        '**/fixtures/**',
        '**/expected/**',
        '**/seeds/**',
        '**/requests/**',
    ],
});
