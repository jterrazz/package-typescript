import { describe, expect, test } from 'vitest';

import { declaredRootsFindings, declaredRootsOf, isDeclaredRoot } from './names.roots.js';

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

    test('declaredRootsFindings — names a root of either declaration that states no reason or holds no file, under its own key', () => {
        // Given - each declaration holding a kept root, a reasonless one and an empty one
        const declared = {
            generated: { gone: 'written by a script', schema: 'written by a script', sql: '' },
            roots: { bruno: 'the collection', old: 'kept once', tmp: ' ' },
        };

        // When - the tree holds bruno/, schema/, sql/ and tmp/
        const findings = declaredRootsFindings(declared, {
            prefix: 'apps/api/',
            roots: new Set(['bruno', 'schema', 'sql', 'tmp']),
        });

        // Then - each declared root is codified, and each finding is filed under its declaration
        expect([isDeclaredRoot(declared, 'schema'), isDeclaredRoot(declared, 'src')]).toStrictEqual(
            [true, false],
        );
        expect(
            findings.map(({ message, path, rule }) => [rule, path, message.split(' · ')[0]]),
        ).toStrictEqual([
            [
                'names/declared-root-holds-files',
                'apps/api/old/',
                "found: `apps/api/old/` is declared in apps/api/jterrazz.config.ts's `typescript.roots` and holds no file",
            ],
            [
                'names/declared-root-states-its-reason',
                'apps/api/tmp/',
                "found: `apps/api/tmp/` is declared in apps/api/jterrazz.config.ts's `typescript.roots` with no reason",
            ],
            [
                'names/declared-root-holds-files',
                'apps/api/gone/',
                "found: `apps/api/gone/` is declared in apps/api/jterrazz.config.ts's `typescript.generated` and holds no file",
            ],
            [
                'names/declared-root-states-its-reason',
                'apps/api/sql/',
                "found: `apps/api/sql/` is declared in apps/api/jterrazz.config.ts's `typescript.generated` with no reason",
            ],
        ]);
    });
});
