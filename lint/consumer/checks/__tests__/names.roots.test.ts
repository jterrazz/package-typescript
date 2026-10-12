import { describe, expect, test } from 'vitest';

import { declaredRootsFindings, declaredRootsOf, isDeclaredRoot } from '../names.roots.js';

const MESSAGES = [
    "found: `apps/api/old/` is declared in apps/api/jterrazz.config.ts's `typescript.roots` and holds no swept file — the sweep drops what git ignores, a Go module's `testdata/` and the ground of a test · why: A root declared in typescript.roots holds a file git does not ignore. · fix: delete the entry · read: docs/reference/quality-checks.md#a-root-beside-the-spine",
    "found: `apps/api/tmp/` is declared in apps/api/jterrazz.config.ts's `typescript.roots` with no reason · why: A root declared in typescript.roots states why the repository keeps it. · fix: say why the repository keeps it · read: docs/reference/quality-checks.md#a-root-beside-the-spine",
    "found: `apps/api/gone/` is declared in apps/api/jterrazz.config.ts's `typescript.roots` and holds no swept file — the sweep drops what git ignores, a Go module's `testdata/` and the ground of a test · why: A root declared in typescript.roots holds a file git does not ignore. · fix: delete the entry · read: docs/reference/quality-checks.md#a-root-beside-the-spine",
    "found: `apps/api/sql/` is declared in apps/api/jterrazz.config.ts's `typescript.roots` with no reason · why: A root declared in typescript.roots states why the repository keeps it. · fix: say why the repository keeps it · read: docs/reference/quality-checks.md#a-root-beside-the-spine",
];

describe('names.roots', () => {
    test('declaredRootsOf — reads the roots a section declares, bare or verbatim, refusing a declaration that is no record', () => {
        // Given - a section declaring one root of each shape, one declaring none, and one writing its declaration as a list
        const sections = [
            {
                roots: {
                    bruno: 'the collection',
                    schema: { reason: 'written by the docs script', verbatim: true },
                },
            },
            {},
            { roots: ['bruno'] },
        ];

        // Then - each declaration read as written, the one that is no record refused by its key
        expect(sections.map((section) => declaredRootsOf(section))).toStrictEqual([
            {
                problem: null,
                roots: {
                    bruno: 'the collection',
                    schema: { reason: 'written by the docs script', verbatim: true },
                },
            },
            { problem: null, roots: {} },
            {
                problem:
                    'holds a `typescript.roots` that is not an object mapping each folder to its reason',
                roots: {},
            },
        ]);
    });

    test('declaredRootsFindings — names a root that states no reason, in either shape, or holds no file, in the order of its name', () => {
        // Given - roots holding a kept one, a reasonless one, an empty one and a verbatim one with a blank reason, out of order
        const declared = {
            sql: { reason: '  ', verbatim: true },
            schema: { reason: 'written by a script', verbatim: true },
            gone: { reason: 'written by a script', verbatim: true },
            tmp: 42,
            old: 'kept once',
            bruno: 'the collection',
        };

        // When - the tree holds bruno/, schema/, sql/ and tmp/
        const findings = declaredRootsFindings(declared, {
            prefix: 'apps/api/',
            roots: new Set(['bruno', 'schema', 'sql', 'tmp']),
            spine: new Set(['src']),
        });

        // Then - each declared root is codified, and each finding is filed under the key, its lesson whole
        expect([isDeclaredRoot(declared, 'schema'), isDeclaredRoot(declared, 'src')]).toStrictEqual(
            [true, false],
        );
        expect(findings).toMatchObject([
            { path: 'apps/api/gone/', rule: 'names/declared-root-holds-files' },
            { path: 'apps/api/old/', rule: 'names/declared-root-holds-files' },
            { path: 'apps/api/sql/', rule: 'names/declared-root-states-its-reason' },
            { path: 'apps/api/tmp/', rule: 'names/declared-root-states-its-reason' },
        ]);
        expect(findings.map(({ message }) => message)).toStrictEqual([
            MESSAGES[2],
            MESSAGES[0],
            MESSAGES[3],
            MESSAGES[1],
        ]);
    });

    test('declaredRootsFindings — refuses a nested key and a folder of the spine as no root, each with the folder to declare or the entry to delete', () => {
        // Given - a nested key, a spine folder and a first-level root, the tree holding all three
        const declared = {
            'apps/playground': 'an Expo app',
            packages: 'the packages',
            tools: 'the tools',
        };

        // When - the spine holds packages
        const findings = declaredRootsFindings(declared, {
            prefix: '',
            roots: new Set(['apps', 'packages', 'tools']),
            spine: new Set(['packages']),
        });

        // Then - the nested key and the spine folder are refused by their own rule, the root stands
        expect(findings.map(({ path, rule }) => [path, rule])).toStrictEqual([
            ['apps/playground/', 'names/declared-root-is-first-level'],
            ['packages/', 'names/declared-root-is-first-level'],
        ]);
        expect(findings.map(({ message }) => message.split(' · ')[0])).toStrictEqual([
            "found: `apps/playground/` is declared in jterrazz.config.ts's `typescript.roots`, and a root is a first-level folder",
            "found: `packages/` is declared in jterrazz.config.ts's `typescript.roots`, and it is a folder of the spine",
        ]);
        expect(findings.map(({ message }) => message.split(' · ')[2])).toStrictEqual([
            'fix: declare the first-level folder, `apps`, or delete the entry',
            'fix: delete the entry: a folder of the spine is already codified, and it cannot be a root too',
        ]);
    });
});
