import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { onlyPasses, passOf } from '../__setup__/check-passes.js';
import { cli } from '../cli.specification.js';

const publish = cli.with({ env: onlyPasses('publish') });

function publishPass(stdout: string): string[] {
    return passOf(stdout, 'Publish (packaging)')
        .split('\n')
        .slice(1)
        .filter((line) => line.trim() !== '');
}

const fixturesFinding = (file: string): string =>
    `${file}:1:1: error publish(no-test-code-in-production): found: ${file} is compiled from src/domain/user.fixtures.ts, a test file · why: a published build never carries test material · fix: cut the production edge no-test-code-in-production names, or take the module out of the entry · read: @jterrazz/test's docs/24-linting.md#no-test-code-in-production`;

const BUILD_FINDING =
    "package.json:1:1: error publish(build-succeeds): found: the build failed — [UNRESOLVED_ENTRY] Cannot resolve entry module src/index.ts. · why: the build guard reads what the build compiles, and a build that fails leaves nothing to judge · fix: make the build pass — `typescript build` names what failed · read: @jterrazz/typescript's docs/reference/quality-checks.md#the-build-guard";

describe('publish-guard', () => {
    test('fails a package whose second export is compiled from a fixtures module, at the chunk the manifest publishes', async () => {
        // Given - a library whose second export imports a fixtures module, its dist laid by hand, resolving the installed @jterrazz/test
        const result = await publish
            .fixture(directory('./__fixtures__/publish/fixtures-module/'))
            .link('@jterrazz/test')
            .exec('check');

        // Then - the pass fails on the second export's chunk, built as the manifest publishes it
        expect(publishPass(result.stdout.text)).toStrictEqual([
            fixturesFinding('dist/index.extra.js'),
            '✗ Failed with exit code 1',
        ]);
    });

    test('passes the same package once its second export no longer imports the fixtures module', async () => {
        // Given - the same library with that import cut
        const result = await publish
            .fixture(directory('./__fixtures__/publish/fixtures-module/'))
            .fixture(directory('./__fixtures__/publish/fixtures-module-cut/'))
            .link('@jterrazz/test')
            .exec('check');

        // Then - the pass is green and says nothing
        expect(publishPass(result.stdout.text)).toStrictEqual(['✓ Passed']);
    });

    test('passes a build whose @jterrazz/test reader fails to load, naming what it threw', async () => {
        // Given - a package that builds, beside an install whose ./oxlint entry throws on import
        const result = await publish
            .fixture(directory('./__fixtures__/publish/own-build/'))
            .link('@jterrazz/test', directory('./__fixtures__/publish/broken-reader/'))
            .exec('check');

        // Then - the pass names what the entry threw
        expect(publishPass(result.stdout.text)).toStrictEqual([
            'publish/no-test-code-in-production: nothing to judge — the @jterrazz/test this package resolves gives no reader of test material — the reader broke',
            '✓ Passed',
        ]);
    });

    test('passes a build whose @jterrazz/test publishes no reader of test material, saying so', async () => {
        // Given - a package that builds, beside an install whose ./oxlint entry loads and exports no reader
        const result = await publish
            .fixture(directory('./__fixtures__/publish/own-build/'))
            .link('@jterrazz/test', directory('./__fixtures__/publish/readerless/'))
            .exec('check');

        // Then - the pass names what the entry lacks, and judges nothing
        expect(publishPass(result.stdout.text)).toStrictEqual([
            'publish/no-test-code-in-production: nothing to judge — the @jterrazz/test this package resolves gives no reader of test material — its `./oxlint` entry exports no reader of test material',
            '✓ Passed',
        ]);
    });

    test('names a test package compiled into a shipped chunk and one it imports undeclared, and judges no chunk `files` leaves out', async () => {
        // Given - a library bundling @vitest/spy though it declares it and ms, importing vitest/config undeclared, @vitest/mocker declared, playwright as a peer and node:path, its second chunk compiled from a fixtures module and left out of `files`
        const result = await publish
            .fixture(directory('./__fixtures__/publish/test-packages/'))
            .link('@jterrazz/test')
            .link('@vitest/spy')
            .link('ms')
            .exec('check');

        // Then - the shipped chunk fails on the test package compiled in and the undeclared one it imports, on nothing it declares, on no runtime package and never on the unshipped chunk; the build it judged left the dist as it was
        expect(publishPass(result.stdout.text)).toStrictEqual([
            "dist/index.js:1:1: error publish(no-test-code-in-production): found: dist/index.js is compiled from @vitest/spy, a test package · why: a published build never carries test material · fix: cut the production edge no-test-code-in-production names, or take the module out of the entry · read: @jterrazz/test's docs/24-linting.md#no-test-code-in-production",
            'dist/index.js:1:1: error publish(no-test-code-in-production): found: dist/index.js imports vitest/config, a test package · why: a published build never carries test material · fix: cut the import, or declare vitest in "dependencies" when the product runs it · read: @jterrazz/test\'s docs/24-linting.md#no-test-code-in-production',
            '✗ Failed with exit code 1',
        ]);
        expect(result.file('dist/index.js').content).toBe('export const tools = [];\n');
    });

    test('judges every chunk of a package that names no `files`, since npm then ships them all', async () => {
        // Given - the same library, its manifest naming no `files`
        const result = await publish
            .fixture(directory('./__fixtures__/publish/test-packages/'))
            .fixture(directory('./__fixtures__/publish/test-packages-unfiled/'))
            .link('@jterrazz/test')
            .link('@vitest/spy')
            .link('ms')
            .exec('check');

        // Then - the guard judges the second chunk too, on the fixtures module it is compiled from
        expect(
            publishPass(result.stdout.text).filter((line) =>
                line.includes('(no-test-code-in-production)'),
            ),
        ).toStrictEqual([
            "dist/index.js:1:1: error publish(no-test-code-in-production): found: dist/index.js is compiled from @vitest/spy, a test package · why: a published build never carries test material · fix: cut the production edge no-test-code-in-production names, or take the module out of the entry · read: @jterrazz/test's docs/24-linting.md#no-test-code-in-production",
            'dist/index.js:1:1: error publish(no-test-code-in-production): found: dist/index.js imports vitest/config, a test package · why: a published build never carries test material · fix: cut the import, or declare vitest in "dependencies" when the product runs it · read: @jterrazz/test\'s docs/24-linting.md#no-test-code-in-production',
            "dist/testing.global-setup.js:1:1: error publish(no-test-code-in-production): found: dist/testing.global-setup.js is compiled from src/orders.fixtures.ts, a test file · why: a published build never carries test material · fix: cut the production edge no-test-code-in-production names, or take the module out of the entry · read: @jterrazz/test's docs/24-linting.md#no-test-code-in-production",
        ]);
    });

    test('judges what the build runs, never its declarations: a type taken from a test package is no finding', async () => {
        // Given - a library whose shipped module takes a type from vitest, a dev dependency, and runs nothing of it
        const result = await publish
            .fixture(directory('./__fixtures__/publish/type-from-test-package/'))
            .link('@jterrazz/test')
            .link('vitest')
            .exec('check');

        // Then - the pass is green: the import is erased from the chunk the package runs
        expect(publishPass(result.stdout.text)).toStrictEqual(['✓ Passed']);
    });

    test('fails the pass on a build that fails, and nothing else', async () => {
        // Given - a package publint and attw accept, whose manifest publishes an entry nobody wrote
        const result = await publish
            .fixture(directory('./__fixtures__/publish/broken-build-alone/'))
            .link('@jterrazz/test')
            .exec('check');

        // Then - the build's one line is the pass's whole report, and it fails the pass
        expect(publishPass(result.stdout.text)).toStrictEqual([
            BUILD_FINDING,
            '✗ Failed with exit code 1',
        ]);
    });

    test('carries on to publint past a build that fails', async () => {
        // Given - a package whose build fails and whose map names a file `files` leaves out
        const result = await publish
            .fixture(directory('./__fixtures__/publish/broken-build/'))
            .link('@jterrazz/test')
            .exec('check');

        // Then - the `files` line, the build line, then publint's own report under the same failed verdict
        const pass = publishPass(result.stdout.text);
        expect(pass.slice(0, 2)).toStrictEqual([
            'package.json:1:1: error publish(export-covered-by-files): ./greeter.js is outside "files" — it resolves here and 404s in a consumer',
            BUILD_FINDING,
        ]);
        expect(pass).toContain(
            '1. pkg.exports["./greeter"] is ./greeter.js but the file is not published. Is it specified in pkg.files?',
        );
        expect(pass.at(-1)).toBe('✗ Failed with exit code 1');
    });
});
