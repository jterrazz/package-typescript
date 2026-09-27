import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, onTestFinished, test } from 'vitest';

import { testMaterialReader } from './test-material.js';

function packageWith(tree: Record<string, string>): string {
    const unit = mkdtempSync(join(tmpdir(), 'test-material-'));
    onTestFinished(() => {
        rmSync(unit, { force: true, recursive: true });
    });
    for (const [path, content] of Object.entries(tree)) {
        mkdirSync(dirname(join(unit, path)), { recursive: true });
        writeFileSync(join(unit, path), content);
    }

    return unit;
}

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
describe('testMaterialReader', () => {
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
        // Given - an install whose ./oxlint entry carries no reader
        const unit = repositoryInstalling('export default {};\n');

        // Then - there is no reader, though the toolchain itself installs one
        await expect(testMaterialReader(unit)).resolves.toStrictEqual({
            error: 'its `./oxlint` entry exports no reader of test material',
            reason: 'unloadable',
        });
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
