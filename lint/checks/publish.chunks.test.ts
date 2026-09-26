import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { build } from 'tsdown';
import { describe, expect, onTestFinished, test } from 'vitest';

import { buildOf, builtChunks } from './publish.chunks.js';

function packageWith(tree: Record<string, string>): string {
    const unit = mkdtempSync(join(tmpdir(), 'publish-chunks-'));
    onTestFinished(() => {
        rmSync(unit, { force: true, recursive: true });
    });
    for (const [path, content] of Object.entries(tree)) {
        mkdirSync(dirname(join(unit, path)), { recursive: true });
        writeFileSync(join(unit, path), content);
    }

    return unit;
}

describe('publish.chunks', () => {
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
});
