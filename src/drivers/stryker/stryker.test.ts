import { createRequire } from 'node:module';
import { describe, expect, test } from 'vitest';

import { strykerConfig } from './stryker.js';

const RUNNER = createRequire(import.meta.url).resolve('@stryker-mutator/vitest-runner');

const SCOPE = { mutated: ['src/**/*.ts', 'src/**/*.tsx', 'lint/*.ts'] };

describe('stryker', () => {
    test('derives the module run and the suite run their own config, reports and incremental file', () => {
        // Given - one source mutated whole by the module run, and a range by the suite's
        const modules = strykerConfig(SCOPE, { mutate: ['src/a.ts'], name: 'modules' });
        const suite = strykerConfig(SCOPE, { mutate: ['src/c.ts:3-4'], name: 'suite' });

        // Then - the module run fast and in its unit project, the suite slower, unrelated and given an hour to start
        const shared = {
            $schema: '../../node_modules/@stryker-mutator/core/schema/stryker-schema.json',
            checkers: [],
            coverageAnalysis: 'perTest',
            disableTypeChecks: '{src/**/!(*.test-d).ts,src/**/!(*.test-d).tsx,lint/!(*.test-d).ts}',
            ignorePatterns: [
                '/.artifacts/**',
                '!/.artifacts/stryker/*.mjs',
                '!/.artifacts/stryker/*.cjs',
                '!/.artifacts/dev/**',
            ],
            ignoreStatic: true,
            incremental: true,
            plugins: [RUNNER],
            reporters: ['clear-text', 'html', 'json', 'progress'],
            tempDirName: '.artifacts/stryker/tmp',
            testRunner: 'vitest',
        };
        expect(modules).toStrictEqual({
            ...shared,
            buildCommand: 'node .artifacts/stryker/sandbox.mjs',
            concurrency: 8,
            htmlReporter: { fileName: '.artifacts/stryker/report.html' },
            incrementalFile: '.artifacts/stryker/incremental.json',
            jsonReporter: { fileName: '.artifacts/stryker/report.json' },
            mutate: ['src/a.ts'],
            timeoutMS: 30_000,
            vitest: { configFile: '.artifacts/stryker/vitest.config.mjs' },
        });
        expect(suite).toStrictEqual({
            ...shared,
            buildCommand: 'node .artifacts/stryker/sandbox.suite.mjs',
            concurrency: 6,
            dryRunTimeoutMinutes: 60,
            htmlReporter: { fileName: '.artifacts/stryker/suite-report.html' },
            incrementalFile: '.artifacts/stryker/suite-incremental.json',
            jsonReporter: { fileName: '.artifacts/stryker/suite-report.json' },
            mutate: ['src/c.ts:3-4'],
            timeoutMS: 60_000,
            vitest: { configFile: '.artifacts/stryker/vitest.suite.config.mjs', related: false },
        });
    });

    test('a scope of one glob hands Stryker the glob itself, never a brace of one', () => {
        // Given - a project that mutates one tree
        const config = strykerConfig({ mutated: ['src/**/*.ts'] }, { mutate: [], name: 'modules' });

        // Then - the type checks are disabled on that glob alone
        expect(config).toMatchObject({ disableTypeChecks: 'src/**/!(*.test-d).ts' });
    });
});
