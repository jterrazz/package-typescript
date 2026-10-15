import { describe, expect, test } from 'vitest';

import { isUnder, namedBy, namesItsOwnBuild, reachOf, roleOf } from '../inputs.js';

describe('inputs', () => {
    test.each([
        ['specs/cli/__fixtures__/app/src/a.ts', { kind: 'ground', root: 'specs/cli' }],
        ['__expected__/out.txt', { kind: 'ground', root: '' }],
        ['src/kit/__tests__/__fixtures__/x.json', { kind: 'ground', root: 'src/kit/__tests__' }],
        ['specs/cli/check/names.spec.ts', { kind: 'test' }],
        ['specs/cli/check/names.spec.yaml', { kind: 'test' }],
        ['src/kit/__tests__/kit.test.ts', { kind: 'test' }],
        ['src/kit/__tests__/kit.test-d.ts', { kind: 'test' }],
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
const missing = './gone.js';`;
        const known = new Set([
            'src/a.ts',
            'src/x/b.ts',
            'src/x/c.ts',
            'src/d.tsx',
            'src/x/e/index.ts',
        ]);

        // Then - each known module once in the order named, the fixture and the missing file left out
        expect(namedBy('src/x/a.test.ts', text, known)).toStrictEqual([
            'src/a.ts',
            'src/x/b.ts',
            'src/x/c.ts',
            'src/d.tsx',
            'src/x/e/index.ts',
        ]);
    });

    test.each([
        ["import { a } from '@jterrazz/typescript/rules';", true],
        ['import a from "@jterrazz/typescript";', true],
        ["const b = await import('#checker');", true],
        ["import { c } from '@jterrazz/typescript-extra';", false],
        ["import { d } from '@jterrazz/test';", false],
    ])('namesItsOwnBuild — %s', (text, named) => {
        // Given - a module of @jterrazz/typescript
        // Then - the package by its name or a `#` import loads its build, a neighbour of the same prefix does not
        expect(namesItsOwnBuild(text, '@jterrazz/typescript')).toBe(named);
    });

    test('namesItsOwnBuild — a package with no name is reached by its `#` imports alone', () => {
        // Given - a package.json with no name
        // Then - no name matches nothing
        expect([
            namesItsOwnBuild("import a from 'undefined';", undefined),
            namesItsOwnBuild("import a from '#a';", undefined),
        ]).toStrictEqual([false, true]);
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
            '@jterrazz/typescript',
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
    });
});
