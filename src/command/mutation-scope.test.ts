import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, describe, expect, test } from 'vitest';

import { changedRanges, fileOf, narrowed, sourcesOf, strykerConfig } from './mutation-scope.js';

const RUNNER = createRequire(import.meta.url).resolve('@stryker-mutator/vitest-runner');

const SCOPE = {
    exclude: [],
    ignore: ['src/generated/**'],
    mutated: ['src/**/*.ts', 'src/**/*.tsx', 'lint/*.ts'],
};

const created: string[] = [];

afterAll(() => {
    for (const root of created) {
        rmSync(root, { force: true, recursive: true });
    }
});

function treeOf(files: readonly string[]): string {
    const root = mkdtempSync(join(tmpdir(), 'mutation-scope-'));
    created.push(root);
    for (const file of files) {
        mkdirSync(join(root, dirname(file)), { recursive: true });
        writeFileSync(join(root, file), '');
    }

    return root;
}

describe('mutation-scope', () => {
    test('splits the sources the declaration names by whether a module test sits beside them, leaving out tests, fixtures and what it ignores', () => {
        // Given - a source with its test, one with a .tsx test, one with none, a fixture, an expected file, a type test, a generated source the project ignores, a source with its test in a folder whose name holds .ts, and a lint entry
        const root = treeOf([
            'src/a.ts',
            'src/a.test.ts',
            'src/b.ts',
            'src/b.test.tsx',
            'src/c.ts',
            'src/_fixtures/d.ts',
            'src/e.fixtures.ts',
            'src/generated/f.ts',
            'src/g.test-d.ts',
            'src/_expected/h.ts',
            'src/legacy.ts.d/i.ts',
            'src/legacy.ts.d/i.test.ts',
            'lint/rule.ts',
        ]);

        // Then - each source once, sorted, on its side
        expect(sourcesOf(root, SCOPE)).toStrictEqual({
            tested: ['src/a.ts', 'src/b.ts', 'src/legacy.ts.d/i.ts'],
            untested: ['lint/rule.ts', 'src/c.ts'],
        });
    });

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
        const config = strykerConfig(
            { exclude: [], ignore: [], mutated: ['src/**/*.ts'] },
            { mutate: [], name: 'modules' },
        );

        // Then - the type checks are disabled on that glob alone
        expect(config).toMatchObject({ disableTypeChecks: 'src/**/!(*.test-d).ts' });
    });

    test('a range names its file, in either spelling, and --mutate narrows the sources to the ranges it names in them', () => {
        // Given - ranges by lines and by positions, a whole file, and a range in a source outside the list
        const ranges = ['src/a.ts:10-20', 'src/b.ts:3:14-5:16', 'src/c.ts', 'src/z.ts:1-2'];

        // Then - each range's file, and the ranges of the listed sources, or every source when no range is named
        expect(ranges.map((range) => fileOf(range))).toStrictEqual([
            'src/a.ts',
            'src/b.ts',
            'src/c.ts',
            'src/z.ts',
        ]);
        expect(narrowed(['src/a.ts', 'src/b.ts', 'src/c.ts'], ranges)).toStrictEqual([
            'src/a.ts:10-20',
            'src/b.ts:3:14-5:16',
            'src/c.ts',
        ]);
        expect(narrowed(['src/a.ts'])).toStrictEqual(['src/a.ts']);
    });

    test('the suite measures each hunk the change made in a source no module test sits beside, and an added source whole', () => {
        // Given - a change of two hunks in one untested source, one added, and one in a source left out
        const changed = new Map<string, (readonly [number, number])[] | true>([
            [
                'src/c.ts',
                [
                    [3, 4],
                    [9, 9],
                ],
            ],
            ['src/new.ts', true],
            ['src/elsewhere.ts', [[1, 1]]],
        ]);

        // Then - a range of whole lines per hunk, the added file whole, and nothing of a file the change missed
        expect(
            changedRanges(['src/c.ts', 'src/new.ts', 'src/untouched.ts'], changed),
        ).toStrictEqual(['src/c.ts:3-4', 'src/c.ts:9-9', 'src/new.ts']);
    });
});
