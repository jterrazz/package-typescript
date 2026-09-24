import { materialAt, testPackageOf } from '@jterrazz/test/oxlint';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { expect, onTestFinished, test } from 'vitest';

import { builtChunks, testMaterialFindings } from './publish-material.js';

/** The reader the guard loads, straight from its owner. */
const reader = { materialAt, testPackageOf };

/** A package root no disk holds, so every path below it is read whole. */
const root = '/package';

/** A package on disk for this test alone, holding `tree` — path to content. */
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

/** The `found` part of each finding, the rest being the same four-part frame. */
const found = (findings: { message: string }[]): string[] =>
    findings.map(({ message }) => message.split(' · ')[0] ?? '');

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
                'found: dist/index.js imports vitest/config, a test package · why: a published build never carries test material · fix: cut the import, or declare vitest in "dependencies" when the product runs it · read: @jterrazz/test\'s docs/19-linting.md#f2-no-test-imports-in-prod',
            path: 'dist/index.js',
            rule: 'publish-test-material',
        },
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
    const chunks = await builtChunks(unit, []);

    // Then - both entries are listed, and nothing was copied, emitted or run
    expect(chunks?.map(({ file }) => file)).toStrictEqual(['dist/index.mjs', 'dist/testing.mjs']);
    expect(existsSync(join(unit, 'dist'))).toBe(false);
    expect(existsSync(join(unit, 'ON_SUCCESS_RAN'))).toBe(false);
});
