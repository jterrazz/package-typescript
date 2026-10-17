import { directory } from '@jterrazz/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { cli } from '../cli.specification.js';

const configOf = (content: string): unknown => JSON.parse(content);

describe('scope', () => {
    test("measures each member in its own folder, its tested sources by its platform and its kind's standard", async () => {
        // Given - a workspace of an expo app, a node api and a library shipping lint rules, none naming anything to mutate, each source with its module test in its folder's __tests__/
        const result = await cli
            .fixture(directory('./__fixtures__/workspace/'))
            .env({ TYPESCRIPT_JOBS: '3' })
            .exec('mutation');

        // Then - each member hands Stryker its own config, on the test runners TYPESCRIPT_JOBS asks for, under its own .artifacts/: the tested sources of its src/, the expo routes and their .tsx, the library's lint rules its standard names; the sandbox builds nothing the member does not
        expect(
            ['apps/api', 'apps/kit', 'apps/mobile'].map((member) =>
                configOf(result.file(`${member}/.artifacts/stryker/stryker.config.json`).content),
            ),
        ).toMatchObject([
            {
                concurrency: 3,
                disableTypeChecks: 'src/**/!(*.test-d).ts',
                mutate: ['src/handler.ts'],
            },
            {
                disableTypeChecks:
                    '{src/**/!(*.test-d).ts,lint/!(*.test-d).ts,lint/consumer/**/!(*.test-d).ts,lint/kit/**/!(*.test-d).ts}',
                mutate: ['lint/consumer/rule.ts'],
            },
            {
                disableTypeChecks: '{src/**/!(*.test-d).{ts,tsx},app/**/!(*.test-d).{ts,tsx}}',
                mutate: ['app/index.tsx', 'src/screen.tsx'],
            },
        ]);
        expect([
            result.file('apps/api/.artifacts/stryker/sandbox.mjs').content.includes('npm'),
            result.file('.artifacts/stryker/stryker.config.json').exists,
        ]).toStrictEqual([false, false]);
        // Then - Stryker, which the fixture installs no runner for, fails each member's run with its own status, and nothing is judged after it
        expect([
            result.exitCode,
            result.stderr.text.includes('ENOENT'),
            result.stdout.text.includes('Measuring the whole suite'),
        ]).toStrictEqual([1, false, false]);
        // Then - the root's verdict is one failed pass per member, with no number a member judged
        const verdict = configOf(result.file('.artifacts/gate/verdict.json').content);
        expect(verdict).toMatchObject({
            command: 'mutation',
            mutation: null,
            passes: ['apps/api', 'apps/kit', 'apps/mobile'].map((label) => ({
                firstError: `${label} failed; its verdict is above`,
                label,
                status: 1,
            })),
            status: 1,
        });
    });

    test('names each member it measures, and measures only the members a --mutate range names', async () => {
        // Given - the same workspace, measured at one range of the api
        const result = await cli
            .fixture(directory('./__fixtures__/workspace/'))
            .exec('mutation --mutate apps/api/src/handler.ts:1-3');

        // Then - the api alone is measured, at its range read from its own folder
        expect(result.stdout.text).toContain(' TYPESCRIPT  apps/api');
        expect(result.stdout.text).not.toContain(' TYPESCRIPT  apps/kit');
        expect(
            configOf(result.file('apps/api/.artifacts/stryker/stryker.config.json').content),
        ).toMatchObject({ mutate: ['src/handler.ts:1-3'] });
        expect(result.file('apps/kit/.artifacts/stryker/stryker.config.json').exists).toBe(false);
    });

    test('refuses a --mutate range that sits in no member, before any member runs', async () => {
        // Given - the same workspace, measured at a range named from the api's own folder
        const result = await cli
            .fixture(directory('./__fixtures__/workspace/'))
            .exec('mutation --mutate src/handler.ts:1-3');

        // Then - the range is refused, and no member is measured
        expect(result.exitCode).toBe(1);
        expect(result.stdout.text).toContain(
            'found: --mutate names src/handler.ts:1-3, which reaches no source the run mutates',
        );
        expect(result.stdout.text).toContain('fix: name a source of a member of the workspace');
        expect(result.file('apps/api/.artifacts/stryker/stryker.config.json').exists).toBe(false);
    });

    test('runs no spec a mobile app drives its simulator with', async () => {
        // Given - a workspace whose expo app is of the mobile kind
        const result = await cli.fixture(directory('./__fixtures__/workspace/')).exec('mutation');

        // Then - the Vitest config the mobile member hands Stryker leaves out its specs/mobile/
        expect(result.file('apps/mobile/.artifacts/stryker/vitest.config.mjs').content).toContain(
            'exclude: ["specs/mobile/**"]',
        );
    });

    test('drops an incremental report whose ground was never recorded before it hands the module run to Stryker', async () => {
        // Given - a project with a module test, and a report left in .artifacts/stryker/ by a run that recorded no ground
        const result = await cli
            .fixture(directory('./__fixtures__/workspace/apps/api/'))
            .prepare((workdir) => {
                mkdirSync(join(workdir, '.artifacts/stryker'), { recursive: true });
                writeFileSync(join(workdir, '.artifacts/stryker/incremental.json'), '{}');
            })
            .exec('mutation');

        // Then - Stryker, which the fixture installs no runner for, fails the run, and the stale report is already gone; the verdict holds the module stage Stryker stopped
        expect(result.exitCode).toBe(1);
        expect(result.file('.artifacts/stryker/incremental.json').exists).toBe(false);
        expect(configOf(result.file('.artifacts/gate/verdict.json').content)).toMatchObject({
            mutation: null,
            passes: [
                {
                    firstError: 'Stryker exited 1; its log is above',
                    label: 'Mutation (module tests)',
                    status: 1,
                },
            ],
            status: 1,
        });
    });
});
