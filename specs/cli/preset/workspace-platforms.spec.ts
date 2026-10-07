import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { cli as oxlintCli } from '../oxlint.specification.js';

describe('workspace-platforms', () => {
    test('the root config of a workspace lints each member by the platform it declares', async () => {
        // Given - a workspace whose react website and node api hold the same list rendered without keys, its root oxlint.config.ts the one-line derived entry
        const result = await oxlintCli
            .fixture(directory('./__fixtures__/workspace-platforms/'))
            .exec('--format unix apps/web/src/list.tsx apps/api/src/list.tsx');

        // Then - the react rule fires in the website and stays silent in the api
        const keyless = result.stdout.text
            .split('\n')
            .filter((line) => line.includes('react(jsx-key)'))
            .map((line) => line.split(':')[0]);
        expect(keyless).toStrictEqual(['apps/web/src/list.tsx']);
    });

    test('a folder a member declares on another platform is linted by that platform', async () => {
        // Given - the node api's web/ declared on react, holding the same keyless list as its src/ and an import with no extension
        const result = await oxlintCli
            .fixture(directory('./__fixtures__/workspace-platforms/'))
            .exec('--format unix apps/api/web/list.tsx apps/api/src/list.tsx');

        // Then - the react rule fires in web/ and stays silent in the rest of the api, and web/ spells its imports as the api's tsconfig resolves them
        const lines = result.stdout.text.split('\n');
        const firing = (rule: string): string[] =>
            lines.filter((line) => line.includes(rule)).map((line) => line.split(':')[0] ?? '');
        expect([firing('react(jsx-key)'), firing('import(extensions)')]).toStrictEqual([
            ['apps/api/web/list.tsx'],
            ['apps/api/web/list.tsx'],
        ]);
    });
});
