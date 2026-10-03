import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { cli } from '../cli.specification.js';

describe('scope', () => {
    test("mutates each member's sources by its platform, and leaves lint/ to a project that names it", async () => {
        // Given - a workspace of an expo app and a node api, neither naming anything to mutate
        const result = await cli.fixture(directory('./_fixtures/workspace/')).exec('mutation');

        // Then - the config handed to Stryker measures src/ everywhere, the expo routes and its .tsx, never lint/, and the sandbox builds nothing the project does not
        const config: unknown = JSON.parse(
            result.file('.artifacts/stryker/stryker.config.json').content,
        );
        expect(config).toMatchObject({
            disableTypeChecks:
                '{src/**/!(*.test-d).ts,apps/api/src/**/!(*.test-d).ts,apps/mobile/src/**/!(*.test-d).{ts,tsx},apps/mobile/app/**/!(*.test-d).{ts,tsx}}',
            mutate: [
                'src/**/*.ts',
                'apps/api/src/**/*.ts',
                'apps/mobile/src/**/*.{ts,tsx}',
                'apps/mobile/app/**/*.{ts,tsx}',
                '!**/*.test.ts',
                '!**/*.test.tsx',
                '!**/*.test-d.ts',
                '!**/*.fixtures.ts',
                '!**/_fixtures/**',
                '!**/_expected/**',
            ],
        });
        expect(result.file('.artifacts/stryker/sandbox.mjs').content).not.toContain('npm');
    });
});
