import { describe, expect, test } from 'vitest';

import { typescriptPreset } from './preset.js';

describe('preset', () => {
    test('typescriptPreset — merges the standard, the kind’s and the platform’s, in that order, into the toolchain’s preset', () => {
        // Given - a library on next
        const preset = typescriptPreset({ kind: 'library', platform: 'next' });

        // Then - the files merged in order, the platform's code and tsconfig preset, the laws of the standard
        expect(preset.origins?.map(({ file, laws }) => [file, laws])).toStrictEqual([
            [
                'src/standard/standard.ts',
                [
                    'kit-knows-no-declaration',
                    'consumer-folders-apart',
                    'self-folders-apart',
                    'catalogue-at-the-bottom',
                    'shipped-lint-reads-no-self',
                    'src-reads-no-declaration',
                ],
            ],
            ['src/standard/kinds/library.ts', []],
            ['src/standard/platforms/next.ts', []],
        ]);
        expect([preset.name, preset.package, preset.baseline]).toStrictEqual([
            'typescript',
            '@jterrazz/typescript',
            ['typescript'],
        ]);
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

        // Then - the standard and the node platform's, nothing a kind adds
        expect([
            preset.origins?.map(({ file }) => file),
            preset.sources,
            preset.settings?.tsconfigPreset,
        ]).toStrictEqual([
            ['src/standard/standard.ts', 'src/standard/platforms/node.ts'],
            { extensions: ['ts'], roots: ['src'] },
            'node',
        ]);
    });
});
