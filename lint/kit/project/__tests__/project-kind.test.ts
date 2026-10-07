import { describe, expect, test } from 'vitest';

import { readProjectKind } from '../project-kind.js';

describe('project-kind', () => {
    test('readProjectKind — reads a kind on a platform it runs on, and a workspace on none', () => {
        // Given - the declarations a project writes
        const declared = [
            { kind: 'library', platform: 'react' },
            { kind: 'api', platform: 'bun' },
            { kind: 'workspace' },
            {},
        ].map((written) => readProjectKind(written));

        // Then - each is read whole, and a file that declares nothing declares no kind
        expect(declared).toStrictEqual([
            { declaration: { kind: 'library', platform: 'react' }, problem: null },
            { declaration: { kind: 'api', platform: 'bun' }, problem: null },
            { declaration: { kind: 'workspace', platform: null }, problem: null },
            { declaration: null, problem: null },
        ]);
    });

    test('readProjectKind — refuses a kind outside the union or none beside a platform, a platform its kind does not run on or no platform at all, and a workspace with one', () => {
        // Given - the declarations the closed unions refuse
        const refused = [
            { kind: 'service', platform: 'node' },
            { platform: 'node' },
            { kind: 'website', platform: 'node' },
            { kind: 'website', platform: 'vue' },
            { kind: 'mobile' },
            { kind: 'workspace', platform: 'node' },
        ].map((written) => readProjectKind(written).problem);

        // Then - each names what it declared and what the union allows
        expect(refused).toStrictEqual([
            'declares the kind `service`, which is none of `library`, `api`, `cli`, `website`, `mobile`, `workspace`',
            'declares the kind `undefined`, which is none of `library`, `api`, `cli`, `website`, `mobile`, `workspace`',
            'declares a `website` on the platform `node`, where a website runs on `react`, `next`, `astro`',
            'declares a `website` on the platform `vue`, where a website runs on `react`, `next`, `astro`',
            'declares a `mobile` on the platform `undefined`, where a mobile runs on `expo`',
            'declares a `platform` for a workspace, whose members each declare their own',
        ]);
    });
});
