import { defineConfig } from 'oxfmt';
import type { OxfmtConfig } from 'oxfmt';

import { keptByteForByte } from '../../../lint/kit/project/byte-for-byte.js';

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
    ignorePatterns: keptByteForByte({}),
});

export default base;
