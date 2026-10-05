import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, onTestFinished, test } from 'vitest';

import { typescriptPreset } from './preset.js';

describe('preset', () => {
    test('typescriptPreset — merges the standard, the kind’s and the platform’s, in that order, into the toolchain’s preset', () => {
        // Given - a library on next
        const preset = typescriptPreset({ kind: 'library', platform: 'next' });

        // Then - the files merged in order, the platform's code and tsconfig preset, the laws of the library's lint tree
        expect(preset.origins?.map(({ file, laws }) => [file, laws])).toStrictEqual([
            ['src/standard/standard.ts', []],
            [
                'src/standard/kinds/library.ts',
                [
                    'kit-knows-no-declaration',
                    'consumer-folders-apart',
                    'self-folders-apart',
                    'catalogue-at-the-bottom',
                    'shipped-lint-reads-no-self',
                    'src-reads-no-declaration',
                ],
            ],
            ['src/standard/platforms/next.ts', []],
        ]);
        expect([preset.name, preset.package, preset.baseline, preset.lawSettings]).toStrictEqual([
            'typescript',
            '@jterrazz/typescript',
            ['typescript'],
            ['lint', 'memberRoots', 'sources', 'spine', 'toolRoots', 'tsconfigPreset', 'words'],
        ]);
    });

    test('typescriptPreset — derives the platform’s code, its editor files and its roots from the merged standard', () => {
        // Given - a library on next
        const preset = typescriptPreset({ kind: 'library', platform: 'next' });

        // Then - the sources, the tsconfig preset, the files, the laws and the tool roots of the merge
        expect([
            preset.sources,
            preset.settings?.tsconfigPreset,
            preset.files,
            preset.layers?.length,
            preset.names,
        ]).toStrictEqual([
            { extensions: ['ts', 'tsx'], roots: ['src', 'app', 'pages'] },
            'next',
            {
                'oxfmt.config.ts': {
                    scope: 'repository',
                    text: "import { oxfmtConfig } from '@jterrazz/typescript/oxfmt';\n\nexport default await oxfmtConfig(import.meta.url);\n",
                },
                'oxlint.config.ts': {
                    scope: 'repository',
                    text: "import { oxlintConfig } from '@jterrazz/typescript/oxlint';\n\nexport default await oxlintConfig(import.meta.url);\n",
                },
                'tsconfig.json': {
                    json: { extends: '@jterrazz/typescript/tsconfig/next' },
                    scope: 'unit',
                },
            },
            6,
            [],
        ]);
        expect(Object.keys(preset.settings?.toolRoots ?? {})).toStrictEqual([
            'bin',
            'config',
            'prisma',
            'app',
            'pages',
            'public',
        ]);
    });

    test('typescriptPreset — reads a project that declares nothing as the node platform’s, with no kind', () => {
        // Given - no declaration
        const preset = typescriptPreset(null);

        // Then - the standard and the node platform's, nothing a kind adds: no law, no lint tree
        expect([
            preset.origins?.map(({ file }) => file),
            preset.sources,
            preset.settings?.tsconfigPreset,
            preset.layers,
            preset.settings?.lint,
        ]).toStrictEqual([
            ['src/standard/standard.ts', 'src/standard/platforms/node.ts'],
            { extensions: ['ts'], roots: ['src'] },
            'node',
            [],
            undefined,
        ]);
    });

    test('typescriptPreset — derives the hexagonal map for a unit whose src/ holds domain/, application/ and infrastructure/', () => {
        // Given - one unit laid out as a hexagonal application, one missing its infrastructure/
        const laidOut = mkdtempSync(join(tmpdir(), 'preset-hexagonal-'));
        const partial = mkdtempSync(join(tmpdir(), 'preset-partial-'));
        for (const layer of ['domain', 'application', 'infrastructure']) {
            mkdirSync(join(laidOut, 'src', layer), { recursive: true });
        }
        mkdirSync(join(partial, 'src', 'domain'), { recursive: true });
        mkdirSync(join(partial, 'src', 'application'), { recursive: true });
        onTestFinished(() => {
            rmSync(laidOut, { force: true, recursive: true });
            rmSync(partial, { force: true, recursive: true });
        });

        // When - the preset derives each unit's section
        const { derive } = typescriptPreset({ kind: 'api', platform: 'node' });

        // Then - only the laid-out unit is held to the map
        expect([derive?.(laidOut), derive?.(partial)]).toStrictEqual([
            { architecture: { hexagonal: true } },
            {},
        ]);
    });
});
