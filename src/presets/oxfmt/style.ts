import { defineConfig } from 'oxfmt';
import type { OxfmtConfig } from 'oxfmt';

import { GROUND_GLOBS } from '../../../lint/kit/project/ground.js';

// outside: sorting is formatting: oxfmt owns import, package.json and Tailwind order, so no lint rule reorders them.
// Width, indent, quotes and commas are the estate's: every repository is written to them.
const base: OxfmtConfig = defineConfig({
    bracketSpacing: true,
    endOfLine: 'lf',
    printWidth: 100,
    semi: true,
    singleQuote: true,
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
    // outside: exact names: oxfmt's Tailwind sorter takes no regex matcher yet.
    sortTailwindcss: {
        functions: ['clsx', 'cn', 'cva', 'tv', 'twMerge', 'twJoin', 'tw'],
    },
    tabWidth: 4,
    trailingComma: 'all',
    useTabs: false,
    // hazard: a content tree can hold signed bytes (jterrazz-web's attestations) one formatter pass would invalidate.
    ignorePatterns: [
        'dist/**',
        'assets/**',
        'public/**',
        '.next/**',
        '.expo/**',
        // invariant: a spec's ground is mis-shaped or held byte for byte on purpose.
        ...GROUND_GLOBS,
    ],
});

export default base;
