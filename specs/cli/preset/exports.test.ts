import { createRequire } from 'node:module';
import { expect, test } from 'vitest';

const require = createRequire(import.meta.url);

// Self-reference resolution — the exports map must cover every consumer-facing subpath.
test.each([
    '@jterrazz/typescript',
    '@jterrazz/typescript/oxlint',
    '@jterrazz/typescript/tsconfig/node',
    '@jterrazz/typescript/tsconfig/node.json',
    '@jterrazz/typescript/tsconfig/next',
    '@jterrazz/typescript/tsconfig/expo',
    '@jterrazz/typescript/tsdown/build',
    '@jterrazz/typescript/tsdown/build.js',
    '@jterrazz/typescript/tsdown/bundle.js',
    '@jterrazz/typescript/presets/tsconfig/node',
    '@jterrazz/typescript/presets/tsconfig/node.json',
    '@jterrazz/typescript/presets/tsdown/bundle',
    '@jterrazz/typescript/presets/tsdown/bundle.js',
])('resolves %s', (specifier) => {
    // Given - a consumer-facing package subpath
    // Then - the specifier resolves to a real file
    expect(() => require.resolve(specifier)).not.toThrow();
});
