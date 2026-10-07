import { describe, expect, test } from 'vitest';

import { declaredRootsFindings, declaredRootsOf, isDeclaredRoot } from '../names.roots.js';

const MESSAGES = [
    "found: `apps/api/old/` is declared in apps/api/jterrazz.config.ts's `typescript.roots` and holds no file · why: A root declared in typescript.roots or typescript.generated holds a file git does not ignore. · fix: delete the entry · read: docs/reference/quality-checks.md#a-root-beside-the-spine",
    "found: `apps/api/tmp/` is declared in apps/api/jterrazz.config.ts's `typescript.roots` with no reason · why: A root declared in typescript.roots or typescript.generated states why the repository keeps it. · fix: say why the repository keeps it · read: docs/reference/quality-checks.md#a-root-beside-the-spine",
    "found: `apps/api/gone/` is declared in apps/api/jterrazz.config.ts's `typescript.generated` and holds no file · why: A root declared in typescript.roots or typescript.generated holds a file git does not ignore. · fix: delete the entry · read: docs/reference/quality-checks.md#a-root-beside-the-spine",
    "found: `apps/api/sql/` is declared in apps/api/jterrazz.config.ts's `typescript.generated` with no reason · why: A root declared in typescript.roots or typescript.generated states why the repository keeps it. · fix: say why the repository keeps it · read: docs/reference/quality-checks.md#a-root-beside-the-spine",
];

describe('names.roots', () => {
    test('declaredRootsOf — reads the roots and the generated roots a section declares, refusing a declaration that is no record', () => {
        // Given - a section declaring one of each, one declaring none, and two each writing one declaration as a list
        const sections = [
            {
                generated: { schema: 'written by the docs script' },
                roots: { bruno: 'the collection' },
            },
            {},
            { roots: ['bruno'] },
            { generated: ['schema'] },
        ];

        // Then - each declaration read apart, the first that is no record refused by its key
        expect(sections.map((section) => declaredRootsOf(section))).toStrictEqual([
            {
                problem: null,
                roots: {
                    generated: { schema: 'written by the docs script' },
                    roots: { bruno: 'the collection' },
                },
            },
            { problem: null, roots: { generated: {}, roots: {} } },
            {
                problem:
                    'holds a `typescript.roots` that is not an object mapping each folder to its reason',
                roots: { generated: {}, roots: {} },
            },
            {
                problem:
                    'holds a `typescript.generated` that is not an object mapping each folder to its reason',
                roots: { generated: {}, roots: {} },
            },
        ]);
    });

    test('declaredRootsFindings — names a root of either declaration that states no reason or holds no file, under its own key, in the order of its name', () => {
        // Given - each declaration holding a kept root, a reasonless one and an empty one, out of order, one reason no string
        const declared = {
            generated: { sql: '  ', schema: 'written by a script', gone: 'written by a script' },
            roots: { tmp: 42, old: 'kept once', bruno: 'the collection' },
        };

        // When - the tree holds bruno/, schema/, sql/ and tmp/
        const findings = declaredRootsFindings(declared, {
            prefix: 'apps/api/',
            roots: new Set(['bruno', 'schema', 'sql', 'tmp']),
        });

        // Then - each declared root is codified, and each finding is filed under its declaration, its lesson whole
        expect([isDeclaredRoot(declared, 'schema'), isDeclaredRoot(declared, 'src')]).toStrictEqual(
            [true, false],
        );
        expect(findings).toMatchObject([
            { path: 'apps/api/old/', rule: 'names/declared-root-holds-files' },
            { path: 'apps/api/tmp/', rule: 'names/declared-root-states-its-reason' },
            { path: 'apps/api/gone/', rule: 'names/declared-root-holds-files' },
            { path: 'apps/api/sql/', rule: 'names/declared-root-states-its-reason' },
        ]);
        expect(findings.map(({ message }) => message)).toStrictEqual(MESSAGES);
    });
});
