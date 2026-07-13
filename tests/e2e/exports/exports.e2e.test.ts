import { createRequire } from 'node:module';
import { describe, expect, test } from 'vitest';

const require = createRequire(import.meta.url);

// Self-reference resolution — verifies the exports map covers every consumer-facing
// subpath, with and without file extensions.
describe('package exports', () => {
    test.each([
        '@jterrazz/typescript',
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
        // Then — the specifier resolves to a real file
        expect(() => require.resolve(specifier)).not.toThrow();
    });
});
