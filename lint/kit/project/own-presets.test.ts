import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { describe, expect, test, vi } from 'vitest';

import { ownPresets } from './own-presets.js';

function repository(): string {
    const root = mkdtempSync(join(tmpdir(), 'own-presets-'));
    writeFileSync(
        join(root, 'self.mjs'),
        "export const self = () => ({ name: 'self', package: '@acme/self' });\n",
    );

    return pathToFileURL(join(root, 'jterrazz.config.ts')).href;
}

describe('ownPresets', () => {
    test('own-presets — calls each preset the build exports, by the name the settings file gives it, the build itself included', async () => {
        // Given - a repository whose build holds its self preset, read by a check and by the build
        const settings = repository();
        const checked = await ownPresets(settings, { './self.mjs': 'self' });
        vi.spyOn(process, 'argv', 'get').mockReturnValue(['node', 'typescript', 'build']);

        // Then - the preset is made from the built module, for the build too
        expect(checked).toStrictEqual([{ name: 'self', package: '@acme/self' }]);
        await expect(ownPresets(settings, { './self.mjs': 'self' })).resolves.toStrictEqual(
            checked,
        );
    });

    test('own-presets — holds no preset while the build makes them, and refuses every other run without them', async () => {
        // Given - a repository whose config preset is not built
        const settings = repository();
        const modules = {
            './dist/config.js': 'test',
            './dist/self.js': 'self',
            './self.mjs': 'self',
        };

        // When - the build reads the settings file, then any other command
        vi.spyOn(process, 'argv', 'get').mockReturnValue(['node', 'typescript', 'build']);
        const building = await ownPresets(settings, modules);
        vi.spyOn(process, 'argv', 'get').mockReturnValue(['node', 'typescript', 'check']);

        // Then - the build runs on no preset, and the check is refused, naming what is missing
        expect(building).toStrictEqual([]);
        await expect(ownPresets(settings, modules)).rejects.toThrow(
            new Error(
                [
                    "found: this repository's presets are not built: ./dist/config.js, ./dist/self.js missing",
                    'why: they are this repository’s own build, and a run without them judges none of what they hold, so it would pass on nothing',
                    'fix: run `npm run build`, then run the command again',
                    'read: docs/reference/configuration.md#a-repository-held-to-its-own-presets',
                ].join(' · '),
            ),
        );
    });

    test('own-presets — refuses a built module that exports no preset by the name given', async () => {
        // Given - a repository whose built module exports its preset as `self`

        // Then - the name the settings file lists is not exported
        await expect(ownPresets(repository(), { './self.mjs': 'test' })).rejects.toThrow(
            new TypeError(
                [
                    'found: ./self.mjs exports no preset `test`',
                    'why: the settings file lists the preset by that name, and a missing one judges none of what it holds',
                    'fix: export `test` from the module ./self.mjs is built from, or name the export it holds',
                    'read: docs/reference/configuration.md#a-repository-held-to-its-own-presets',
                ].join(' · '),
            ),
        );
    });
});
