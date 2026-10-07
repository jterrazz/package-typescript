import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { cli } from '../cli.specification.js';

describe('scope', () => {
    test("mutates each member's tested sources by its platform and its kind's standard, and leaves lint/ to a project that names it", async () => {
        // Given - a workspace of an expo app, a node api and a library shipping lint rules, none naming anything to mutate, each source but one with its module test in its folder's __tests__/
        const result = await cli.fixture(directory('./__fixtures__/workspace/')).exec('mutation');

        // Then - the config handed to Stryker mutates the tested sources of src/ everywhere, of the expo routes and its .tsx, the library's lint rules its standard names under its own folder, never the workspace's lint/ nor a source no module test proves, and the sandbox builds nothing the project does not
        const config: unknown = JSON.parse(
            result.file('.artifacts/stryker/stryker.config.json').content,
        );
        expect(config).toMatchObject({
            disableTypeChecks:
                '{src/**/!(*.test-d).ts,apps/api/src/**/!(*.test-d).ts,apps/kit/src/**/!(*.test-d).ts,apps/mobile/src/**/!(*.test-d).{ts,tsx},apps/mobile/app/**/!(*.test-d).{ts,tsx},apps/kit/lint/!(*.test-d).ts,apps/kit/lint/consumer/**/!(*.test-d).ts,apps/kit/lint/kit/**/!(*.test-d).ts}',
            mutate: [
                'apps/api/src/handler.ts',
                'apps/kit/lint/consumer/rule.ts',
                'apps/mobile/app/index.tsx',
                'apps/mobile/src/screen.tsx',
                'src/root.ts',
            ],
        });
        expect(result.file('.artifacts/stryker/sandbox.mjs').content).not.toContain('npm');
        // Then - Stryker, which the fixture installs no runner for, fails the run with its own status, and nothing is judged after it
        expect(result.exitCode).toBe(1);
        expect(result.stderr.text).not.toContain('ENOENT');
        expect(result.stdout.text).not.toContain('Measuring the whole suite');
    });
});
