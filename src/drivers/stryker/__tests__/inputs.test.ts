import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';

import {
    changedBetween,
    inputsOf,
    isLoadable,
    isUnder,
    namedBy,
    namesItsOwnBuild,
    ownBuildOf,
    reachOf,
    roleOf,
} from '../inputs.js';

const roots: string[] = [];

const placeholder = (name: string): string => ['$', '{', name, '}'].join('');

const OWN_BUILD = ownBuildOf({
    exports: { './rules': './dist/rules.js', './tsconfig/*': './tsconfig/*.json' },
    imports: { '#checker': './dist/checker.js', '#internal/*.js': './dist/internal/*.js' },
    name: '@jterrazz/typescript',
});

function projectWith(files: Record<string, string>): string {
    const root = mkdtempSync(join(tmpdir(), 'incremental-'));
    roots.push(root);
    execFileSync('git', ['init', '--quiet'], { cwd: root });
    for (const [path, text] of Object.entries(files)) {
        mkdirSync(join(root, path, '..'), { recursive: true });
        writeFileSync(join(root, path), text);
    }
    mkdirSync(join(root, '.artifacts/stryker'), { recursive: true });

    return root;
}

afterEach(() => {
    for (const root of roots.splice(0)) {
        rmSync(root, { force: true, recursive: true });
    }
});

describe('inputs', () => {
    test.each([
        ['specs/cli/__fixtures__/app/src/a.ts', { kind: 'ground', root: 'specs/cli' }],
        ['__expected__/out.txt', { kind: 'ground', root: '' }],
        ['src/kit/__tests__/__fixtures__/x.json', { kind: 'ground', root: 'src/kit/__tests__' }],
        ['specs/cli/check/names.spec.ts', { kind: 'test' }],
        ['specs/cli/check/names.spec.yaml', { kind: 'test' }],
        ['src/kit/__tests__/kit.test.ts', { kind: 'test' }],
        ['src/kit/__tests__/kit.test-d.ts', { kind: 'test' }],
        ['src/kit/__tests__/kit.test.mts', { kind: 'test' }],
        ['specs/cli/check/names.spec.yml', { kind: 'test' }],
        ['specs/cli/check/names.spec.yaml.orig', { kind: 'everything' }],
        ['src/kit/__tests__/kit.test.ts.snap', { kind: 'everything' }],
        ['src/kit/kit.mts', { kind: 'source' }],
        ['specs/cli/__setup__/run-temp-root.ts', { kind: 'everything' }],
        ['vitest.config.ts', { kind: 'everything' }],
        ['package-lock.json', { kind: 'everything' }],
        ['docs/reference/quality-checks.md', { kind: 'everything' }],
        ['lint/consumer/catalogue/findings.json', { kind: 'everything' }],
        ['src/kit/kit.ts', { kind: 'source' }],
        ['specs/cli/cli.specification.ts', { kind: 'source' }],
        ['src/site/page.astro', { kind: 'source' }],
    ])('roleOf — %s', (path, role) => {
        // Given - a path of the project
        // Then - the file reaches the tests its role names
        expect(roleOf(path)).toStrictEqual(role);
    });

    test('isUnder — a ground at the root is read by every test, one under a folder by the tests below it alone', () => {
        // Given - tests at the root, in the folder, and in a sibling sharing its prefix
        // Then - the root reaches all, a folder its own tree, never a sibling sharing its prefix
        expect([
            isUnder('specs/a.spec.ts', ''),
            isUnder('specs/cli/a.spec.ts', 'specs/cli'),
            isUnder('specs/cli-two/a.spec.ts', 'specs/cli'),
            isUnder('specs/a.spec.ts', 'specs/cli'),
        ]).toStrictEqual([true, true, false, false]);
    });

    test('namedBy — every quoted relative path to a known module, its built name swapped for its source', () => {
        // Given - a test naming modules by import, export, dynamic import, mock and folder, and a fixture path
        const text = `import { a } from '../a.js';
export * from './b';
const c = await import("./c.js");
vi.mock(\`../d.jsx\`);
import e from './e';
const fixture = '../__fixtures__/f.ts';
const missing = './gone.js';
import f from './f';
import g from './g.mjs';
import h from './h.cjs';
import i from './i.js';
import j from './j.mjs';`;
        const known = new Set([
            'src/a.ts',
            'src/x/b.ts',
            'src/x/c.ts',
            'src/d.tsx',
            'src/x/e/index.ts',
            'src/x/f.tsx',
            'src/x/g.mts',
            'src/x/h.cts',
            'src/x/i.tsx',
            'src/x/j.tsx',
        ]);

        // Then - each known module once in the order named, each built extension for its own source's, the fixture, the missing file and a `.mjs` with no `.mts` left out
        expect(namedBy('src/x/a.test.ts', text, known)).toStrictEqual([
            'src/a.ts',
            'src/x/b.ts',
            'src/x/c.ts',
            'src/d.tsx',
            'src/x/e/index.ts',
            'src/x/f.tsx',
            'src/x/g.mts',
            'src/x/h.cts',
            'src/x/i.tsx',
        ]);
    });

    test.each([
        ["import { a } from '@jterrazz/typescript/rules';", true],
        ["const t = require.resolve('@jterrazz/typescript/tsconfig/node');", true],
        ["const b = await import('#checker');", true],
        ["const c = await import('#internal/walk.js');", true],
        ["const c = await import('#internal/walk.ts');", false],
        ["const c = await import('#external/walk.js');", false],
        ["const c = await import('#checkers');", false],
        ["const c = await import('#checke#checker');", false],
        [`const d = await import(\`@jterrazz/typescript/${placeholder('tool')}\`);`, true],
        [`const e = await import(\`#${placeholder('name')}\`);`, true],
        ['import a from "@jterrazz/typescript";', false],
        ["import { f } from '@jterrazz/typescript/unexported';", false],
        ["const shebang = '#!/usr/bin/env node';", false],
        ['const heading = "# ADR-1: Title";', false],
        ["const owner = { package: '@jterrazz/typescript' };", false],
        ["import { g } from '@jterrazz/typescript-extra';", false],
        ["import { h } from '@jterrazz/test';", false],
    ])('namesItsOwnBuild — %s', (text, named) => {
        // Given - a module of a package whose manifest opens two subpaths and two imports
        // Then - only a specifier the manifest resolves loads its build, a template one read as resolving; the bare name it does not export, a shebang, a heading, the name held as data and a neighbour of the same prefix do not
        expect(namesItsOwnBuild(text, OWN_BUILD)).toBe(named);
    });

    test.each([
        ['no exports, so every subpath', { name: '@scope/a' }, [true, true, false]],
        [
            'a string export, the bare name alone',
            { exports: './x.js', name: '@scope/a' },
            [true, false, false],
        ],
        [
            'conditions alone, the bare name alone',
            { exports: { import: './x.js' }, name: '@scope/a' },
            [true, false, false],
        ],
        ['no name, its imports alone', { imports: { '#a': './a.js' } }, [false, false, true]],
    ])('ownBuildOf — a manifest with %s', (_case, manifest, named) => {
        // Given - a manifest
        const build = ownBuildOf(manifest);

        // Then - the bare name, a subpath and a `#` import load the build as the manifest opens them
        expect([
            namesItsOwnBuild("import a from '@scope/a';", build),
            namesItsOwnBuild("import a from '@scope/a/deep';", build),
            namesItsOwnBuild("import a from '#a';", build),
        ]).toStrictEqual(named);
    });

    test('namesItsOwnBuild — a package with no name loads nothing by a bare specifier', () => {
        // Given - a manifest with no name and no exports
        const build = ownBuildOf({});

        // Then - not even a specifier spelling the missing name
        expect(namesItsOwnBuild("import a from 'undefined';", build)).toBe(false);
    });

    test('ownBuildOf — no manifest opens no import and every subpath of no name', () => {
        // Given - no package.json to read
        // Then - nothing named, nothing exported nor imported
        expect(ownBuildOf(undefined)).toStrictEqual({
            exports: undefined,
            imports: [],
            name: undefined,
        });
    });

    test('reachOf — what a file loads to the end of its imports, a cycle walked once, and whether any of them loads the build', () => {
        // Given - a test reaching a, which reaches b, which reaches a again; c reached by nothing; d loading the build
        const reach = reachOf(
            new Map([
                ['src/__tests__/a.test.ts', "import '../a.js';"],
                ['src/a.ts', "import { b } from './b.js';"],
                ['src/b.ts', "import { a } from './a.js';"],
                ['src/c.ts', "import { b } from './b.js';"],
                ['src/d.ts', "import x from '@jterrazz/typescript';"],
                ['src/__tests__/d.test.ts', "import { d } from '../d.js';"],
            ]),
            ownBuildOf({ name: '@jterrazz/typescript' }),
        );

        // Then - the cycle once, c out of reach; the build reached through d
        expect(reach('src/__tests__/a.test.ts')).toStrictEqual({
            everything: false,
            files: new Set(['src/a.ts', 'src/b.ts']),
        });
        expect(reach('src/__tests__/d.test.ts')).toStrictEqual({
            everything: true,
            files: new Set(['src/d.ts']),
        });
        expect(reach('src/__tests__/a.test.ts')).toBe(reach('src/__tests__/a.test.ts'));
        expect(reach('src/__tests__/unknown.test.ts')).toStrictEqual({
            everything: false,
            files: new Set(),
        });
    });

    test('changedBetween — a file whose bytes differ, one added and one removed', () => {
        // Given - two records of the inputs
        const before = { a: '1', b: '2', c: '3' };
        const after = { a: '1', b: '9', d: '4' };

        // Then - each change once, the unchanged file left out
        expect(changedBetween(before, after).toSorted()).toStrictEqual(['b', 'c', 'd']);
    });

    test('inputsOf — hashes every file git lists, the ignored ones, folders and the run’s own output aside, and stands for an absent install', () => {
        // Given - a source, an ignored file, and a report of the run git would list
        const root = projectWith({
            '.artifacts/stryker/report.json': '{}',
            '.gitignore': 'ignored.ts\n',
            'ignored.ts': 'x',
            'src/a.ts': 'a',
        });

        // When - the inputs are read
        const inputs = inputsOf(root) ?? {};

        // Then - every listed file by its hash, the install as absent
        expect(Object.keys(inputs).toSorted()).toStrictEqual([
            '.gitignore',
            'node_modules/.package-lock.json',
            'src/a.ts',
        ]);
        expect([inputs['src/a.ts'], inputs['node_modules/.package-lock.json']]).toStrictEqual([
            'ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb',
            'absent',
        ]);
    });

    test('inputsOf — a file git still tracks that the tree no longer holds is no input', () => {
        // Given - two tracked sources, one then deleted from the disk
        const root = projectWith({ 'src/a.ts': 'a', 'src/gone.ts': 'gone' });
        execFileSync('git', ['add', '--all'], { cwd: root });
        rmSync(join(root, 'src/gone.ts'));

        // Then - the deleted one is no input
        expect(Object.keys(inputsOf(root) ?? {}).toSorted()).toStrictEqual([
            'node_modules/.package-lock.json',
            'src/a.ts',
        ]);
    });

    test('inputsOf — the install is read by its hash once there is one', () => {
        // Given - an install
        const root = projectWith({ 'src/a.ts': 'a' });
        mkdirSync(join(root, 'node_modules'));
        writeFileSync(join(root, 'node_modules/.package-lock.json'), 'a');

        // Then - its bytes' hash
        expect(inputsOf(root)?.['node_modules/.package-lock.json']).toBe(
            'ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb',
        );
    });

    test('isLoadable — every module a test may load, a setup helper and a root config included, ground and data aside', () => {
        // Given - a source, a test, a setup helper, a root config, a fixture module and a data file
        const paths = [
            'src/a.ts',
            'src/__tests__/a.test.ts',
            'specs/__setup__/rulebook.ts',
            'vitest.config.ts',
            'specs/__fixtures__/app/src/a.ts',
            'src/catalogue.json',
        ];

        // Then - the four modules a test may load
        expect(paths.filter((path) => isLoadable(path))).toStrictEqual([
            'src/a.ts',
            'src/__tests__/a.test.ts',
            'specs/__setup__/rulebook.ts',
            'vitest.config.ts',
        ]);
    });
});
