import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, readdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { stripVTControlCharacters } from 'node:util';
import { describe, expect, test } from 'vitest';

import { onlyPasses, passOf, SELECTING_BIN } from '../check-passes.js';
import { temporaryDirectory } from '../temporary-directory.js';

// `node_modules` is gitignored, so no fixture can carry the @jterrazz/test the package resolves.

const FIXTURES = resolve(import.meta.dirname, 'fixtures/publish');
const INSTALLED = resolve(import.meta.dirname, '../../../node_modules/@jterrazz/test');

function consumer(...fixtures: string[]): string {
    const root = temporaryDirectory('spec-publish-guard-');
    for (const fixture of fixtures) {
        cpSync(join(FIXTURES, fixture), root, { recursive: true });
    }
    mkdirSync(join(root, 'node_modules/@jterrazz'), { recursive: true });
    symlinkSync(INSTALLED, join(root, 'node_modules/@jterrazz/test'), 'dir');

    return root;
}

function consumerOfStub(fixture: string, oxlint: string): string {
    const root = temporaryDirectory('spec-publish-guard-');
    cpSync(join(FIXTURES, fixture), root, { recursive: true });
    const install = join(root, 'node_modules/@jterrazz/test');
    mkdirSync(install, { recursive: true });
    writeFileSync(join(install, 'oxlint.mjs'), oxlint);
    writeFileSync(
        join(install, 'package.json'),
        JSON.stringify({
            exports: { './oxlint': { import: './oxlint.mjs' } },
            name: '@jterrazz/test',
            version: '17.0.0',
        }),
    );

    return root;
}

function run(
    dir: string,
    command: string,
    env: Record<string, string> = {},
): { status: null | number; stdout: string } {
    const result = spawnSync('bash', [SELECTING_BIN, command], {
        cwd: dir,
        encoding: 'utf8',
        env: { ...process.env, ...env, INIT_CWD: dir },
    });

    return { status: result.status, stdout: stripVTControlCharacters(result.stdout) };
}

function publishPass(stdout: string): string[] {
    return passOf(stdout, 'Publish (packaging)')
        .split('\n')
        .slice(1)
        .filter((line) => line.trim() !== '');
}

function chunksOn(root: string): string[] {
    return readdirSync(join(root, 'dist'))
        .filter((name) => /\.[cm]?js$/u.test(name))
        .map((name) => `dist/${name}`)
        .toSorted();
}

const fixturesFinding = (file: string): string =>
    `publish/no-test-code-in-production  ${file}  found: ${file} is compiled from src/domain/user.fixtures.ts, a test file · why: a published build never carries test material · fix: cut the production edge no-test-code-in-production names, or take the module out of the entry · read: @jterrazz/test's docs/19-linting.md#no-test-code-in-production`;

const BUILD_FINDING =
    "publish/build-succeeds  package.json  found: the build failed — [UNRESOLVED_ENTRY] Cannot resolve entry module src/index.ts. · why: the build guard reads what the build compiles, and a build that fails leaves nothing to judge · fix: make the build pass — its own tsdown.config, else `typescript bundle` · read: @jterrazz/typescript's docs/06-quality-checks.md#the-build-guard";

describe('publish-guard', () => {
    test('fails a build whose second export is compiled from a fixtures module, naming each file `bundle` wrote', () => {
        // Given - a library whose second export imports a fixtures module, resolving @jterrazz/test, built by `typescript bundle`
        const root = consumer('fixtures-module/');
        expect(run(root, 'bundle').status).toBe(0);

        // When - the quality checks run
        const { stdout } = run(root, 'check', onlyPasses('publish'));

        // Then - the pass fails on one finding per chunk of the second export, each named as the build wrote it
        expect(chunksOn(root)).toStrictEqual([
            'dist/extra.cjs',
            'dist/extra.js',
            'dist/index.cjs',
            'dist/index.js',
        ]);
        expect(publishPass(stdout)).toStrictEqual([
            fixturesFinding('dist/extra.cjs'),
            fixturesFinding('dist/extra.js'),
            '✗ Failed with exit code 1',
        ]);
    });

    test('passes the same package once its second export no longer imports the fixtures module', () => {
        // Given - the same library with that import cut, built by `typescript bundle`
        const root = consumer('fixtures-module/', 'fixtures-module-cut/');
        expect(run(root, 'bundle').status).toBe(0);

        // When - the quality checks run
        const { stdout } = run(root, 'check', onlyPasses('publish'));

        // Then - the pass is green and says nothing
        expect(publishPass(stdout)).toStrictEqual(['✓ Passed']);
    });

    test('passes a build whose @jterrazz/test reader fails to load, naming what it threw', () => {
        // Given - a package that builds, beside an install whose ./oxlint entry throws on import
        const root = consumerOfStub('own-build/', "throw new Error('the reader broke');\n");

        // When - the quality checks run
        const { stdout } = run(root, 'check', onlyPasses('publish'));

        // Then - the pass names what the entry threw
        expect(publishPass(stdout)).toStrictEqual([
            'publish/no-test-code-in-production: nothing to judge — the @jterrazz/test this package resolves gives no reader of test material — the reader broke',
            '✓ Passed',
        ]);
    });

    test('fails the pass on a build that fails, and nothing else', () => {
        // Given - a package publint and attw accept, whose own config names an entry nobody wrote
        const root = consumer('broken-build-alone/');

        // When - the quality checks run
        const { stdout } = run(root, 'check', onlyPasses('publish'));

        // Then - the build's one line is the pass's whole report, and it fails the pass
        expect(publishPass(stdout)).toStrictEqual([BUILD_FINDING, '✗ Failed with exit code 1']);
    });

    test('carries on to publint past a build that fails', () => {
        // Given - a package whose build fails and whose map names a file `files` leaves out
        const root = consumer('broken-build/');

        // When - the quality checks run
        const { stdout } = run(root, 'check', onlyPasses('publish'));

        // Then - the `files` line, the build line, then publint's own report under the same failed verdict
        const pass = publishPass(stdout);
        expect(pass.slice(0, 2)).toStrictEqual([
            'publish/export-covered-by-files  package.json  ./greeter.js is outside "files" — it resolves here and 404s in a consumer',
            BUILD_FINDING,
        ]);
        expect(pass).toContain(
            '1. pkg.exports["./greeter"] is ./greeter.js but the file is not published. Is it specified in pkg.files?',
        );
        expect(pass.at(-1)).toBe('✗ Failed with exit code 1');
    });
});
