import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { generatedRoots, strykerConfig } from '../stryker.js';

const RUNNER = createRequire(import.meta.url).resolve('@stryker-mutator/vitest-runner');

const CHECKER = createRequire(import.meta.url).resolve('#mutant-checker');

const SCOPE = {
    generated: [],
    mutated: ['src/**/*.ts', 'src/**/*.tsx', 'lint/*.ts'],
    typeChecked: true,
};

describe('stryker', () => {
    test('hands Stryker a dynamic-route file as a path, not as a glob', () => {
        // Given - an Astro route whose folder and file are named in brackets, whole and by lines
        const config = strykerConfig(
            SCOPE,
            {
                mutate: [
                    'src/pages/[locale]/[key].png.ts',
                    'src/pages/[locale]/[key].png.ts:15-18',
                ],
                name: 'suite',
            },
            { concurrency: 1 },
        );

        // Then - each bracket is a class of its own, and the line range left as it was
        expect(config).toMatchObject({
            mutate: [
                'src/pages/[[]locale[]]/[[]key[]].png.ts',
                'src/pages/[[]locale[]]/[[]key[]].png.ts:15-18',
            ],
        });
    });

    test('derives the module run and the suite run their own config, reports and incremental file', () => {
        // Given - one source mutated whole by the module run, and a range by the suite's
        const modules = strykerConfig(
            SCOPE,
            { mutate: ['src/a.ts'], name: 'modules' },
            { concurrency: 8, terminal: false },
        );
        const suite = strykerConfig(
            SCOPE,
            { mutate: ['src/c.ts:3-4'], name: 'suite' },
            { concurrency: 6, terminal: false },
        );

        // Then - the module run fast and in its unit project, the suite slower, unrelated and given an hour to start
        const shared = {
            $schema: '../../node_modules/@stryker-mutator/core/schema/stryker-schema.json',
            checkers: ['typescript-native'],
            coverageAnalysis: 'perTest',
            disableTypeChecks: '{src/**/!(*.test-d).ts,src/**/!(*.test-d).tsx,lint/!(*.test-d).ts}',
            ignorePatterns: [
                '/.artifacts/**',
                '!/.artifacts/stryker/*.mjs',
                '!/.artifacts/stryker/*.cjs',
                '!/.artifacts/dev/**',
            ],
            ignoreStatic: true,
            ignorers: ['typescript-logs', 'typescript-pinned-text'],
            incremental: true,
            plugins: [
                RUNNER,
                CHECKER,
                './.artifacts/stryker/progress-reporter.mjs',
                './.artifacts/stryker/previous-killers.mjs',
                './.artifacts/stryker/ignorers.mjs',
            ],
            reporters: ['html', 'json', 'typescript-progress', 'typescript-previous-killers'],
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

    test("a terminal keeps Stryker's own progress bar beside the run's reporter", () => {
        // Given - a run whose output is a terminal
        const config = strykerConfig(
            SCOPE,
            { mutate: ['src/a.ts'], name: 'modules' },
            { concurrency: 2, terminal: true },
        );

        // Then - Stryker draws its bar, and the run's reporter still says how long the dry run took
        expect(config).toMatchObject({
            reporters: [
                'html',
                'json',
                'progress',
                'typescript-progress',
                'typescript-previous-killers',
            ],
        });
    });

    test('a scope of one glob hands Stryker the glob itself, never a brace of one', () => {
        // Given - a project that mutates one tree and keeps no tsconfig.json
        const config = strykerConfig(
            { generated: [], mutated: ['src/**/*.ts'], typeChecked: false },
            { mutate: [], name: 'modules' },
            { concurrency: 1 },
        );

        // Then - the type checks are disabled on that glob alone, and no mutant is type-checked
        expect(config).toMatchObject({ checkers: [], disableTypeChecks: 'src/**/!(*.test-d).ts' });
    });

    test('a tool root git ignores stays out of the sandbox, and a tracked one goes in', () => {
        // Given - an Expo app whose prebuild laid ios/, which its .gitignore names, beside its tracked app/
        const project = mkdtempSync(join(tmpdir(), 'mutation-generated-'));
        execFileSync('git', ['init', '--quiet'], { cwd: project });
        writeFileSync(join(project, '.gitignore'), '/ios\n');
        mkdirSync(join(project, 'ios'));
        mkdirSync(join(project, 'app'));

        // When - the run reads which of its tool roots a tool generated
        const generated = generatedRoots(project, ['android', 'app', 'ios']);
        rmSync(project, { force: true, recursive: true });

        // Then - ios/ alone is left out of the copy Stryker makes
        expect(generated).toStrictEqual(['ios']);
        expect(
            strykerConfig(
                { generated, mutated: ['src/**/*.ts'], typeChecked: true },
                { mutate: [], name: 'modules' },
                { concurrency: 1 },
            ),
        ).toMatchObject({
            ignorePatterns: [
                '/.artifacts/**',
                '/ios',
                '!/.artifacts/stryker/*.mjs',
                '!/.artifacts/stryker/*.cjs',
                '!/.artifacts/dev/**',
            ],
        });
    });

    test('a dry run limited to test files hands Stryker those files, each path held literal, and an unlimited one names none', () => {
        // Given - a suite stage limited to a dynamic route's spec and a plain one, and the same stage unlimited
        const stage = { mutate: ['src/a.ts'], name: 'suite' } as const;
        const scope = { generated: [], mutated: ['src/a.ts'], typeChecked: false };
        const limited = strykerConfig(scope, stage, {
            concurrency: 2,
            testFiles: ['specs/[id].spec.ts', 'specs/a.spec.ts'],
        });
        const unlimited = strykerConfig(scope, stage, { concurrency: 2 });

        // Then - the limited run names the two files, the unlimited one leaves Stryker every file
        expect(limited).toMatchObject({ testFiles: ['specs/[[]id[]].spec.ts', 'specs/a.spec.ts'] });
        expect(Object.hasOwn(unlimited, 'testFiles')).toBe(false);
    });
});
