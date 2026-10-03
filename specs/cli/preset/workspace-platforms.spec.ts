import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { cli as oxlintCli } from '../oxlint.specification.js';

describe('workspace-platforms', () => {
    test('the root config of a workspace lints each member by the platform it declares', async () => {
        // Given - a workspace whose react website and node api hold the same list rendered without keys, its root oxlint.config.ts the one-line derived entry
        const result = await oxlintCli
            .fixture(directory('./_fixtures/workspace-platforms/'))
            .exec('--format unix apps/web/src/list.tsx apps/api/src/list.tsx');

        // Then - the react rule fires in the website and stays silent in the api
        const keyless = result.stdout.text
            .split('\n')
            .filter((line) => line.includes('react(jsx-key)'))
            .map((line) => line.split(':')[0]);
        expect(keyless).toStrictEqual(['apps/web/src/list.tsx']);
    });
});
