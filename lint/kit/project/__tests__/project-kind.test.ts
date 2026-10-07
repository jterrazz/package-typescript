import { describe, expect, test } from 'vitest';

import { declaredAs, publishes, readProjectKind } from '../project-kind.js';

describe('project-kind', () => {
    test('readProjectKind — reads a kind on a platform it runs on, and a workspace on none', () => {
        // Given - the declarations a project writes
        const declared = [
            { kind: 'library', platform: 'react' },
            { kind: 'api', platform: 'bun' },
            { kind: 'workspace' },
            { platform: 'bun' },
            {},
        ].map((written) => readProjectKind(written));

        // Then - each is read whole, and a file that declares nothing declares no kind
        expect(declared).toStrictEqual([
            { declaration: { kind: 'library', platform: 'react' }, problem: null },
            { declaration: { kind: 'api', platform: 'bun' }, problem: null },
            { declaration: { kind: 'workspace', platform: null }, problem: null },
            { declaration: { kind: null, platform: 'bun' }, problem: null },
            { declaration: null, problem: null },
        ]);
    });

    test('readProjectKind — refuses a kind outside the union or none beside a platform no suite runs on, a platform its kind does not run on or no platform at all, and a workspace with one', () => {
        // Given - the declarations the closed unions refuse
        const refused = [
            { kind: 'service', platform: 'node' },
            { platform: 'react' },
            { kind: 'website', platform: 'node' },
            { kind: 'website', platform: 'vue' },
            { kind: 'mobile' },
            { kind: 'workspace', platform: 'node' },
        ].map((written) => readProjectKind(written).problem);

        // Then - each names what it declared and what the union allows
        expect(refused).toStrictEqual([
            'declares the kind `service`, which is none of `library`, `api`, `cli`, `website`, `mobile`, `workspace`',
            'declares the kind `undefined`, which is none of `library`, `api`, `cli`, `website`, `mobile`, `workspace`',
            'declares a `website` on the platform `node`, where a website runs on `react`, `next`, `astro`, `browser`',
            'declares a `website` on the platform `vue`, where a website runs on `react`, `next`, `astro`, `browser`',
            'declares a `mobile` on the platform `undefined`, where a mobile runs on `expo`',
            'declares a `platform` for a workspace, whose members each declare their own',
        ]);
    });

    test('publishes — publishes a library or a cli unless its manifest is private, and nothing else', () => {
        // Given - each kind that publishes and one that does not, public and private, and a suite
        const read = [
            [{ kind: 'library', platform: 'node' }, {}],
            [{ kind: 'cli', platform: 'bun' }, { private: false }],
            [{ kind: 'library', platform: 'node' }, { private: true }],
            [{ kind: 'cli', platform: 'bun' }, { private: true }],
            [{ kind: 'api', platform: 'node' }, {}],
            [{ kind: null, platform: 'node' }, {}],
            [null, {}],
            [undefined, {}],
        ] as const;

        // Then - a private manifest takes a publishing kind out of npm's reach
        expect(read.map(([identity, manifest]) => publishes(identity, manifest))).toStrictEqual([
            true,
            true,
            false,
            false,
            false,
            false,
            false,
            false,
        ]);
    });

    test('declaredAs — reads a kind on its platform, a suite by name, and a workspace on its members', () => {
        // Given - a kind, a suite and a workspace
        const read = [
            { kind: 'library', platform: 'react' },
            { kind: null, platform: 'bun' },
            { kind: 'workspace', platform: null },
        ] as const;

        // Then - each reads as the drift report's declared row says it
        expect(read.map((identity) => declaredAs(identity))).toStrictEqual([
            'library on react',
            'a suite on bun',
            "workspace on its members' platforms",
        ]);
    });
});
