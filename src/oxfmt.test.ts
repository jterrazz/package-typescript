import { expect, test } from 'vitest';

import { base, defineConfig } from './oxfmt.js';

test('exports the shared formatting preset', () => {
    // Given - the tool-facing entry
    // Then - the preset carries the ecosystem's format: four spaces, single quotes, 100 columns
    expect(base).toMatchObject({ printWidth: 100, singleQuote: true, tabWidth: 4 });
});

test("re-exports oxfmt's own defineConfig", () => {
    // Given - a config a consumer would write, with oxfmt declared nowhere in its project
    const config = { printWidth: 80 };

    // Then - the entry carries the tool's helper, which returns the config unchanged
    expect(defineConfig(config)).toBe(config);
});
