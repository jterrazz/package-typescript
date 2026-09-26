import { materialAt, testPackageOf } from '@jterrazz/test/oxlint';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { build } from 'tsdown';
import { describe, expect, onTestFinished, test } from 'vitest';

import { buildOf, builtChunks, testMaterialFindings, testMaterialReader } from './test-material.js';

const reader = { materialAt, testPackageOf };

// No disk holds it, so every path below it is read whole.
const root = '/package';

function packageWith(tree: Record<string, string>): string {
    const unit = mkdtempSync(join(tmpdir(), 'publish-material-'));
    onTestFinished(() => {
        rmSync(unit, { force: true, recursive: true });
    });
    for (const [path, content] of Object.entries(tree)) {
        mkdirSync(dirname(join(unit, path)), { recursive: true });
        writeFileSync(join(unit, path), content);
    }

    return unit;
}

const found = (findings: { message: string }[]): string[] =>
    findings.map(({ message }) => message.split(' · ')[0] ?? '');

function repositoryInstalling(oxlint: string): string {
    return packageWith({
        '.git/HEAD': 'ref: refs/heads/main\n',
        'node_modules/@jterrazz/test/oxlint.mjs': oxlint,
        'node_modules/@jterrazz/test/package.json': JSON.stringify({
            exports: { './oxlint': { import: './oxlint.mjs' } },
            name: '@jterrazz/test',
        }),
        'package.json': '{ "type": "module" }\n',
    });
}
describe('test-material', () => {
    test('names a local module that is test material, and passes one that is not', () => {
        // Given - one shipped file compiled from an entry, a fixtures module and a ground file
        const chunks = [
            {
                externals: [],
                file: 'dist/index.js',
                moduleIds: [
                    '/package/src/index.ts',
                    '/package/src/domain/user.fixtures.ts',
                    '/package/src/seeds/users.ts',
                ],
            },
        ];

        // Then - the two modules are named, each by what it is
        expect(found(testMaterialFindings({ chunks, manifest: {}, reader, root }))).toStrictEqual([
            'found: dist/index.js is compiled from src/domain/user.fixtures.ts, a test file',
            'found: dist/index.js is compiled from src/seeds/users.ts, ground',
        ]);
    });

    test('names an installed test package compiled in, whatever the manifest declares', () => {
        // Given - a chunk carrying vitest's own module, vitest declared, beside a runtime package
        const chunks = [
            {
                externals: [],
                file: 'dist/index.js',
                moduleIds: [
                    '/package/node_modules/@vitest/expect/dist/index.js',
                    '/package/node_modules/zod/index.js',
                    '\u0000rolldown/runtime.js',
                ],
            },
        ];
        const manifest = { dependencies: { '@vitest/expect': '^4.0.0' } };

        // Then - the test package is named, the runtime one and the virtual module are not
        expect(found(testMaterialFindings({ chunks, manifest, reader, root }))).toStrictEqual([
            'found: dist/index.js is compiled from @vitest/expect, a test package',
        ]);
    });

    test('names an external test package the manifest does not declare to run', () => {
        // Given - two externals, one of them declared as a peer
        const chunks = [
            {
                externals: ['vitest/config', 'playwright', 'zod'],
                file: 'dist/index.js',
                moduleIds: ['/package/src/index.ts'],
            },
        ];
        const manifest = { peerDependencies: { playwright: '^1.0.0' } };

        // Then - only the undeclared one is named, with the declaration as its fix
        const findings = testMaterialFindings({ chunks, manifest, reader, root });
        expect(findings).toStrictEqual([
            {
                message:
                    'found: dist/index.js imports vitest/config, a test package · why: a published build never carries test material · fix: cut the import, or declare vitest in "dependencies" when the product runs it · read: @jterrazz/test\'s docs/19-linting.md#no-test-code-in-production',
                path: 'dist/index.js',
                rule: 'publish/no-test-code-in-production',
            },
        ]);
    });

    test('judges only the chunks `files` ships', () => {
        // Given - two chunks compiled from a fixtures module, one of them left out of `files`
        const chunks = ['dist/index.js', 'dist/testing.js'].map((file) => ({
            externals: [],
            file,
            moduleIds: ['/package/src/domain/user.fixtures.ts'],
        }));

        // Then - `files` naming one ships that one alone; no `files` ships both
        expect(
            found(
                testMaterialFindings({
                    chunks,
                    manifest: { files: ['dist/index.js'] },
                    reader,
                    root,
                }),
            ),
        ).toStrictEqual([
            'found: dist/index.js is compiled from src/domain/user.fixtures.ts, a test file',
        ]);
        expect(found(testMaterialFindings({ chunks, manifest: {}, reader, root }))).toStrictEqual([
            'found: dist/index.js is compiled from src/domain/user.fixtures.ts, a test file',
            'found: dist/testing.js is compiled from src/domain/user.fixtures.ts, a test file',
        ]);
    });

    test('builds a package by its own config, leaving the disk as it found it', async () => {
        // Given - a package whose own config builds two entries, copies an asset and runs a command
        const unit = packageWith({
            'assets/note.txt': 'note\n',
            'package.json': '{ "type": "module" }\n',
            'src/index.ts': 'export const one = 1;\n',
            'src/testing.ts': 'export const two = 2;\n',
            'tsdown.config.mjs': [
                "import { writeFileSync } from 'node:fs';",
                'export default {',
                "    copy: [{ from: 'assets/note.txt', to: 'dist' }],",
                "    entry: ['src/index.ts', 'src/testing.ts'],",
                "    format: 'esm',",
                "    onSuccess: () => writeFileSync(new URL('ON_SUCCESS_RAN', import.meta.url), ''),",
                '};',
                '',
            ].join('\n'),
        });

        // When - the guard builds it
        const chunks = await builtChunks(unit, buildOf(unit, []));

        // Then - both entries are listed, and nothing was copied, emitted or run
        expect(chunks?.map(({ file }) => file)).toStrictEqual([
            'dist/index.mjs',
            'dist/testing.mjs',
        ]);
        expect(existsSync(join(unit, 'dist'))).toBe(false);
        expect(existsSync(join(unit, 'ON_SUCCESS_RAN'))).toBe(false);
    });

    test("names each chunk as the package's own build writes it", async () => {
        // Given - a module package whose own config sets no extension, so tsdown picks `.mjs`
        const unit = packageWith({
            'package.json': '{ "type": "module" }\n',
            'src/index.ts': 'export const one = 1;\n',
            'tsdown.config.mjs': "export default { entry: ['src/index.ts'], dts: false };\n",
        });

        // When - the guard builds it, and then the package builds itself
        const chunks = await builtChunks(unit, buildOf(unit, []));
        await build({ config: join(unit, 'tsdown.config.mjs'), cwd: unit, logLevel: 'silent' });

        // Then - the guard's names are the files the build wrote
        expect(chunks?.map(({ file }) => file)).toStrictEqual(
            readdirSync(join(unit, 'dist'))
                .filter((name) => /\.[cm]?js$/u.test(name))
                .map((name) => `dist/${name}`),
        );
    });

    test('loads the reader from the install the package resolves', async () => {
        // Given - an install whose ./oxlint entry publishes both readers
        const unit = repositoryInstalling(
            "export const materialAt = () => 'own';\nexport const testPackageOf = () => 'own';\n",
        );

        // Then - the readers are that install's
        const loaded = await testMaterialReader(unit);
        expect('reader' in loaded && loaded.reader.materialAt('/package/src/index.ts')).toBe('own');
    });

    test('loads no reader where the install publishes none, and never asks the toolchain', async () => {
        // Given - an older install whose ./oxlint entry carries no reader
        const unit = repositoryInstalling('export default {};\n');

        // Then - there is no reader, though the toolchain itself installs one
        await expect(testMaterialReader(unit)).resolves.toStrictEqual({ reason: 'readerless' });
    });

    test('loads no reader where the package resolves no @jterrazz/test', async () => {
        // Given - a repository with no install at all, beside a toolchain that has one
        const unit = packageWith({
            '.git/HEAD': 'ref: refs/heads/main\n',
            'package.json': '{ "type": "module" }\n',
        });

        // Then - it is absent, not borrowed from the toolchain's own location
        await expect(testMaterialReader(unit)).resolves.toStrictEqual({ reason: 'absent' });
    });
});
