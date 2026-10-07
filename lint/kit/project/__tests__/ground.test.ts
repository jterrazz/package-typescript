import { describe, expect, test } from 'vitest';

import { isSpecialFolderName, moduleStemOfTest, moduleTestOf } from '../ground.js';

describe('ground', () => {
    test('isSpecialFolderName — a word closed by two underscores on each side, and nothing else', () => {
        // Given - the spellings a folder name takes
        const names = [
            '__setup__',
            '__a-b2__',
            '_setup',
            '__setup',
            'x__setup__',
            '__setup__x',
            '____',
            '__Setup__',
        ];

        // Then - only the closed words read as special
        expect(names.map((name) => [name, isSpecialFolderName(name)])).toStrictEqual([
            ['__setup__', true],
            ['__a-b2__', true],
            ['_setup', false],
            ['__setup', false],
            ['x__setup__', false],
            ['__setup__x', false],
            ['____', false],
            ['__Setup__', false],
        ]);
    });

    test('moduleTestOf — the test of a module sits in the __tests__/ of its folder, its extension kept last', () => {
        // Given - modules of each extension, one at no folder, one with no source extension and one whose extension is not last
        const modules = [
            'src/a/foo.ts',
            'src/b.tsx',
            'lib/c.mts',
            'd.cjs',
            'src/e',
            'src/f.ts.orig',
        ];

        // Then - each named in its tests folder, the suffix before the extension
        expect(modules.map((module) => moduleTestOf(module))).toStrictEqual([
            'src/a/__tests__/foo.test.ts',
            'src/__tests__/b.test.tsx',
            'lib/__tests__/c.test.mts',
            '__tests__/d.test.cjs',
            'src/__tests__/e.test',
            'src/__tests__/f.ts.orig.test',
        ]);
        expect(moduleTestOf('src/g.ts', '.test-d')).toBe('src/__tests__/g.test-d.ts');
    });

    test('moduleStemOfTest — a test in a __tests__/ names the module of the folder above it, any other none', () => {
        // Given - tests in and out of a tests folder
        const tests = [
            'src/a/__tests__/foo.test.ts',
            '__tests__/b.test-d.ts',
            'src/__tests__/c.test.tsx',
            'src/d.test.ts',
            'src/my__tests__/e.test.ts',
        ];

        // Then - the module's path less its extension, or null
        expect(tests.map((one) => moduleStemOfTest(one))).toStrictEqual([
            'src/a/foo',
            'b',
            'src/c',
            null,
            null,
        ]);
    });
});
