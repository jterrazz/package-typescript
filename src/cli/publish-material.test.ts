import { materialAt, testPackageOf } from '@jterrazz/test/oxlint';
import { expect, test } from 'vitest';

import { testMaterialFindings } from './publish-material.js';

/** The reader the guard loads, straight from its owner. */
const reader = { materialAt, testPackageOf };

/** A package root no disk holds, so every path below it is read whole. */
const root = '/package';

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
