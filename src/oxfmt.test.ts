import { expect, test } from 'vitest';

import { base, defineConfig } from './oxfmt.js';

test('exports the shared formatting preset', () => {
    // Given - the tool-facing entry
    // Then - the preset carries the ecosystem's format: four spaces, single quotes, 100 columns
    expect(base).toMatchObject({ printWidth: 100, singleQuote: true, tabWidth: 4 });
});

test('gives the formatter the three sorters, so no lint rule owns an order', () => {
    // Given - the shared preset
    // Then - import order, package.json key order and Tailwind class order are oxfmt's
    expect(base.sortImports).toMatchObject({ ignoreCase: true, order: 'asc' });
    expect(base.sortPackageJson).toBe(true);
    expect(base.sortTailwindcss).toStrictEqual({
        functions: ['clsx', 'cn', 'cva', 'tv', 'twMerge', 'twJoin', 'tw'],
    });
});

test('leaves the ground a spec stands on unformatted, by its bare names', () => {
    // Given - the shared preset
    // Then - the four folders @jterrazz/test reserves under specs/ are skipped, and nothing underscored
    expect(base.ignorePatterns).toStrictEqual(
        expect.arrayContaining([
            '**/specs/**/fixtures/**',
            '**/specs/**/expected/**',
            '**/specs/**/seeds/**',
            '**/specs/**/requests/**',
        ]),
    );
    expect(base.ignorePatterns?.filter((pattern) => pattern.includes('/_'))).toStrictEqual([]);
});

test("re-exports oxfmt's own defineConfig", () => {
    // Given - a config a consumer would write, with oxfmt declared nowhere in its project
    const config = { printWidth: 80 };

    // Then - the entry carries the tool's helper, which returns the config unchanged
    expect(defineConfig(config)).toBe(config);
});
