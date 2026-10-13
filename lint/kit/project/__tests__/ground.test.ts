import { matchesGlob } from 'node:path';
import { describe, expect, test } from 'vitest';

import {
    GO_TEST_FILE,
    GROUND_GLOB,
    isSpecialFolder,
    isSpecialFolderName,
    moduleStemOfTest,
    moduleTestOf,
    RENAMED_FOLDERS,
    RETIRED_SHARED_FOLDERS,
    UNCRUISED_PATHS,
} from '../ground.js';

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

    test('goTestFile — a file whose name ends on _test.go, and no other that only holds the text', () => {
        // Given - a test file, a file with a suffix after it and one with it mid-name
        // Then - only the first is a Go test file
        expect(
            ['a_test.go', 'a_test.go.bak', 'a_test.gone'].map((name) => GO_TEST_FILE.test(name)),
        ).toStrictEqual([true, false, false]);
    });

    test('uncruisedPaths — leaves out the ground of a test and the output of a run, at the root and below it, and no folder that merely resembles them', () => {
        // Given - paths of the ground folders, of `.artifacts/` at the root and in a member, and look-alikes
        const paths = [
            'specs/cli/__fixtures__/a/b.ts',
            'src/__expected__/out.ts',
            '.artifacts/vitest/deps-chunk.js',
            'apps/api/.artifacts/stryker/tmp/a.ts',
            'src/artifacts/a.ts',
            'src/not.artifacts/a.ts',
            'src/xartifacts/a.ts',
            'src/xx__fixtures__/a.ts',
            'src/fixtures/a.ts',
        ];

        // Then - the first four are left out of the cruise, the look-alikes are cruised
        expect(paths.map((path) => new RegExp(UNCRUISED_PATHS, 'u').test(path))).toStrictEqual([
            true,
            true,
            true,
            true,
            false,
            false,
            false,
            false,
            false,
        ]);
    });

    test('groundGlob — matches what lies under a ground folder at any depth, and no other', () => {
        // Given - paths in the four ground folders, at the root and deep, and paths that only resemble them
        const paths = [
            'specs/__fixtures__/a.json',
            'src/x/__tests__/__expected__/deep/b.json',
            '__seeds__/c.sql',
            '__requests__/d.http',
            'src/__tests__/foo.test.ts',
            'src/fixtures/e.json',
            'src/__fixtures__',
        ];

        // Then - the first four, and not the others
        expect(paths.map((path) => matchesGlob(path, GROUND_GLOB))).toStrictEqual([
            true,
            true,
            true,
            true,
            false,
            false,
            false,
        ]);
    });

    test('isSpecialFolder — the setup folder and the four ground folders, and no other name', () => {
        // Given - the five, a retired spelling and a code root's folder
        const names = ['__setup__', '__fixtures__', '__expected__', '__seeds__', '__requests__'];

        // Then - the five are special, the others not
        expect(
            [...names, 'setup', '__tests__', ''].map((name) => isSpecialFolder(name)),
        ).toStrictEqual([true, true, true, true, true, false, false, false]);
    });

    test('the retired spellings — each earlier name points at the folder that replaced it', () => {
        // Given - the tables
        // Then - the earlier names, each with its successor, and the two retired shared folders
        expect([RENAMED_FOLDERS, RETIRED_SHARED_FOLDERS]).toStrictEqual([
            {
                _expected: '__expected__',
                _fixtures: '__fixtures__',
                _requests: '__requests__',
                _seeds: '__seeds__',
                _setup: '__setup__',
                doubles: '__setup__',
                expected: '__expected__',
                fixtures: '__fixtures__',
                requests: '__requests__',
                seeds: '__seeds__',
                setup: '__setup__',
            },
            ['_shared', 'shared'],
        ]);
    });

    test('moduleStemOfTest — drops the whole test suffix of any module extension, and only at the end of the name', () => {
        // Given - tests of every extension, a type test, and a name holding the suffix twice
        const tests = [
            'a/__tests__/foo.test.mts',
            'a/__tests__/foo.test-d.tsx',
            'a/__tests__/foo.test.js',
            'a/__tests__/foo.test.ts.bak',
        ];

        // Then - the stem of each, the last one untouched
        expect(tests.map((one) => moduleStemOfTest(one))).toStrictEqual([
            'a/foo',
            'a/foo',
            'a/foo',
            'a/foo.test.ts.bak',
        ]);
    });
});
