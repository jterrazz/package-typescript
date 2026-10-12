import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, onTestFinished, test } from 'vitest';

import {
    besideLinksDropped,
    besideOf,
    generatedRoots,
    startsCold,
    strykerConfig,
} from '../stryker.js';

const RUNNER = createRequire(import.meta.url).resolve('@stryker-mutator/vitest-runner');

const SCOPE = { generated: [], mutated: ['src/**/*.ts', 'src/**/*.tsx', 'lint/*.ts'] };

describe('stryker', () => {
    test('startsCold — only the whole suite starts from no report, and only when the run asked for it', () => {
        // Given - both stages, asked cold and not
        const modules = { mutate: [], name: 'modules' } as const;
        const suite = { mutate: [], name: 'suite' } as const;

        // Then - the suite alone, and only cold
        expect([
            startsCold(suite, true),
            startsCold(suite, false),
            startsCold(modules, true),
            startsCold(modules, false),
        ]).toStrictEqual([true, false, false, false]);
    });

    test('hands Stryker a dynamic-route file as a path, not as a glob', () => {
        // Given - an Astro route whose folder and file are named in brackets, whole and by lines
        const config = strykerConfig(SCOPE, {
            mutate: ['src/pages/[locale]/[key].png.ts', 'src/pages/[locale]/[key].png.ts:15-18'],
            name: 'suite',
        });

        // Then - the brackets are escaped and the line range left as it was
        expect(config).toMatchObject({
            mutate: [
                String.raw`src/pages/\[locale\]/\[key\].png.ts`,
                String.raw`src/pages/\[locale\]/\[key\].png.ts:15-18`,
            ],
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
            reporters: ['html', 'json', 'progress'],
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
            { generated: [], mutated: ['src/**/*.ts'] },
            { mutate: [], name: 'modules' },
        );

        // Then - the type checks are disabled on that glob alone
        expect(config).toMatchObject({ disableTypeChecks: 'src/**/!(*.test-d).ts' });
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
            strykerConfig({ generated, mutated: ['src/**/*.ts'] }, { mutate: [], name: 'modules' }),
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

    test('besideOf — a member of a repository is placed by its depth, with the visible entries of the repository to lay beside its copy, and a repository itself or a folder outside any is not', () => {
        // Given - a repository holding a member two folders down, a hidden folder, node_modules and visible entries; and a folder in no repository
        const root = mkdtempSync(join(tmpdir(), 'beside-'));
        onTestFinished(() => {
            rmSync(root, { force: true, recursive: true });
        });
        mkdirSync(join(root, '.git'));
        mkdirSync(join(root, 'node_modules'));
        mkdirSync(join(root, 'testdata'));
        mkdirSync(join(root, 'docs'));
        mkdirSync(join(root, 'packages/server'), { recursive: true });
        const outside = mkdtempSync(join(tmpdir(), 'beside-none-'));
        onTestFinished(() => {
            rmSync(outside, { force: true, recursive: true });
        });

        // Then - the member is two levels down with docs, packages and testdata beside it; the repository root and the loose folder place nothing
        expect([
            besideOf(join(root, 'packages/server')),
            besideOf(root),
            besideOf(outside),
        ]).toStrictEqual([
            { levels: 2, names: ['docs', 'packages', 'testdata'], root },
            undefined,
            undefined,
        ]);
    });

    test("besideLinksDropped — the links laid in the member's artifacts folder go, a real entry of the same name and a depth that lands elsewhere stay", () => {
        // Given - a member whose artifacts folder holds a link to a repository folder and a real folder of a name also asked for
        const project = mkdtempSync(join(tmpdir(), 'beside-links-'));
        onTestFinished(() => {
            rmSync(project, { force: true, recursive: true });
        });
        mkdirSync(join(project, '.artifacts/real'), { recursive: true });
        mkdirSync(join(project, 'target'));
        symlinkSync(join(project, 'target'), join(project, '.artifacts/apps'));
        symlinkSync(join(project, 'target'), join(project, '.artifacts/stray'));
        const root = join(project, 'target');

        // When - three folders out of the copy are dropped, and a depth of four is
        besideLinksDropped(project, { levels: 4, names: ['apps'], root });
        const kept = existsSync(join(project, '.artifacts/apps'));
        besideLinksDropped(project, { levels: 3, names: ['apps', 'real'], root });

        // Then - the four-deep call left the link, the three-deep one took it, and neither touched the real folder or the name not asked for
        expect([
            kept,
            existsSync(join(project, '.artifacts/apps')),
            existsSync(join(project, '.artifacts/real')),
            existsSync(join(project, '.artifacts/stray')),
        ]).toStrictEqual([true, false, true, true]);
    });
});
