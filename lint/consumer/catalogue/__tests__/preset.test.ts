import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, onTestFinished, test } from 'vitest';

import { objectOf } from '../../../kit/project/json.js';
import { typescriptPreset } from '../preset.js';

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

    test('typescriptPreset — reads a workspace suite as its platform’s alone, with no kind’s standard', () => {
        // Given - the kind-less declaration of a workspace's own suite
        const preset = typescriptPreset({ kind: null, platform: 'bun' });

        // Then - the standard and the bun platform's, nothing a kind adds
        expect([
            preset.origins?.map(({ file }) => file),
            preset.settings?.tsconfigPreset,
        ]).toStrictEqual([['src/standard/standard.ts', 'src/standard/platforms/bun.ts'], 'bun']);
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

    test('typescriptPreset — merges the standard of each package the manifest declares, after the platform’s', () => {
        // Given - an api on node declaring Prisma's client and a package with no standard
        const preset = typescriptPreset(
            { kind: 'api', platform: 'node' },
            new Set(['@prisma/client', 'hono']),
        );

        // Then - Prisma's standard last, its override in the merged settings
        expect([preset.origins?.map(({ file }) => file), preset.settings?.oxlint]).toStrictEqual([
            [
                'src/standard/standard.ts',
                'src/standard/kinds/api.ts',
                'src/standard/platforms/node.ts',
                'src/standard/dependencies/prisma.ts',
            ],
            {
                overrides: [
                    {
                        files: ['src/index.ts'],
                        reason: 'the process entry decides how the process ends: a graceful stop exits 0, a failed start or stop exits 1',
                        rules: { 'unicorn/no-process-exit': 'off' },
                    },
                    {
                        files: ['src/infrastructure/outbound/persistence/**'],
                        reason: 'a Prisma batch transaction takes the lazy PrismaPromises its queries return, and an async wrapper would run each query before the transaction does',
                        rules: { 'typescript/promise-function-async': 'off' },
                    },
                ],
            },
        ]);
    });

    test('typescriptPreset — a tool that reads a folder or loads a package by name brings what knip and the Names pass cannot see', () => {
        // Given - an expo app declaring patch-package, Appium's iOS driver and Astro's checker
        const preset = typescriptPreset(
            { kind: 'mobile', platform: 'expo' },
            new Set(['@astrojs/check', 'appium-xcuitest-driver', 'patch-package']),
        );
        const { knip, toolRoots } = objectOf(preset.settings);
        const ignored = objectOf(knip).ignoreDependencies;

        // Then - each package's standard after the kind's and the platform's, patches/ beside the platform's roots, and both packages named to knip
        expect([
            preset.origins?.map(({ file }) => file).slice(3),
            Object.keys(objectOf(toolRoots)),
            Object.keys(objectOf(ignored)),
        ]).toStrictEqual([
            [
                'src/standard/dependencies/astro-check.ts',
                'src/standard/dependencies/appium-xcuitest-driver.ts',
                'src/standard/dependencies/patch-package.ts',
            ],
            ['bin', 'config', 'prisma', 'android', 'app', 'assets', 'ios', 'patches'],
            ['@astrojs/check', 'appium-xcuitest-driver'],
        ]);
    });
});
