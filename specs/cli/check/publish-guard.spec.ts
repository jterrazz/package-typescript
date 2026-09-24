import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { stripVTControlCharacters } from 'node:util';
import { describe, expect, onTestFinished, test } from 'vitest';

/*
 * A chain, not a document: the build guard judges by the @jterrazz/test the
 * PACKAGE resolves, and `node_modules` is gitignored, so no fixture can carry
 * one. Each case copies its fixture into a temp directory and links this
 * checkout's install beside it, the way npm would. What a document can state
 * — a package resolving none — stays a document.
 */

const BIN = resolve(import.meta.dirname, '../../../bin/typescript.sh');
const FIXTURES = resolve(import.meta.dirname, 'fixtures/publish');
const INSTALLED = resolve(import.meta.dirname, '../../../node_modules/@jterrazz/test');

/** The fixtures spread into one temp directory, in order, with @jterrazz/test installed. */
function consumer(...fixtures: string[]): string {
    const root = mkdtempSync(resolve(tmpdir(), 'spec-publish-guard-'));
    onTestFinished(() => {
        rmSync(root, { force: true, recursive: true });
    });
    for (const fixture of fixtures) {
        cpSync(join(FIXTURES, fixture), root, { recursive: true });
    }
    mkdirSync(join(root, 'node_modules/@jterrazz'), { recursive: true });
    symlinkSync(INSTALLED, join(root, 'node_modules/@jterrazz/test'), 'dir');

    return root;
}

/** One run of the product command in `dir`, colours stripped. */
function run(dir: string, command: string): { status: null | number; stdout: string } {
    const result = spawnSync('bash', [BIN, command], {
        cwd: dir,
        encoding: 'utf8',
        env: { ...process.env, INIT_CWD: dir },
    });

    return { status: result.status, stdout: stripVTControlCharacters(result.stdout) };
}

/** What the Publish pass printed under its header, its verdict included, one line per entry. */
function publishPass(stdout: string): string[] {
    const block = stdout.slice(stdout.indexOf(' RUN  Publish (packaging)'));
    const end = block.indexOf(' RUN ', 1);

    return (end === -1 ? block : block.slice(0, end))
        .split('\n')
        .slice(1)
        .filter((line) => line.trim() !== '');
}

/** The one finding a chunk compiled from the fixtures module earns. */
const fixturesFinding = (file: string): string =>
    `publish-test-material  ${file}  found: ${file} is compiled from src/domain/user.fixtures.ts, a test file · why: a published build never carries test material · fix: cut the production edge F2 names, or take the module out of the entry · read: @jterrazz/test's docs/19-linting.md#f2-no-test-imports-in-prod`;

const BUILD_FINDING =
    "publish-build  package.json  found: the build failed — [UNRESOLVED_ENTRY] Cannot resolve entry module src/index.ts. · why: the build guard reads what the build compiles, and a build that fails leaves nothing to judge · fix: make the build pass — its own tsdown.config, else `typescript bundle` · read: @jterrazz/typescript's docs/06-quality-checks.md#the-build-guard";

describe('publish-guard', () => {
    test('fails a build whose entry is compiled from a fixtures module', () => {
        // Given - a library whose entry imports a fixtures module, resolving @jterrazz/test, built by `typescript bundle`
        const root = consumer('fixtures-module/');
        expect(run(root, 'bundle').status).toBe(0);

        // When - the quality checks run
        const { stdout } = run(root, 'check');

        // Then - the pass fails on one finding per chunk
        expect(publishPass(stdout)).toStrictEqual([
            fixturesFinding('dist/index.cjs'),
            fixturesFinding('dist/index.js'),
            '✗ Failed with exit code 1',
        ]);
    });

    test('passes the same package once its entry no longer imports the fixtures module', () => {
        // Given - the same library with the import cut, built by `typescript bundle`
        const root = consumer('fixtures-module/', 'fixtures-module-cut/');
        expect(run(root, 'bundle').status).toBe(0);

        // When - the quality checks run
        const { stdout } = run(root, 'check');

        // Then - the pass is green and says nothing
        expect(publishPass(stdout)).toStrictEqual(['✓ Passed']);
    });

    test('carries on to publint past a build that fails', () => {
        // Given - a package whose build fails and whose map names a file `files` leaves out
        const root = consumer('broken-build/');

        // When - the quality checks run
        const { stdout } = run(root, 'check');

        // Then - the `files` line, the build line, then publint's own report under the same failed verdict
        const pass = publishPass(stdout);
        expect(pass.slice(0, 2)).toStrictEqual([
            'publish-files  package.json  ./greeter.js is outside "files" — it resolves here and 404s in a consumer',
            BUILD_FINDING,
        ]);
        expect(pass).toContain(
            '1. pkg.exports["./greeter"] is ./greeter.js but the file is not published. Is it specified in pkg.files?',
        );
        expect(pass.at(-1)).toBe('✗ Failed with exit code 1');
    });
});
