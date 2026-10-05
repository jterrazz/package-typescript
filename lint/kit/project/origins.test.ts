import { describe, expect, test } from 'vitest';

import { originLines } from './origins.js';
import { layer } from './preset.fixtures.js';
import { resolveConfig } from './preset.js';
import type { Preset } from './preset.js';

const BASE: Preset = {
    layers: [layer('base-law')],
    name: 'typescript',
    origins: [
        { file: 'src/standard/kinds/api.ts', settings: { tool: 'a' } },
        {
            file: 'src/standard/standard.ts',
            laws: ['base-law'],
            settings: { roster: ['x'], spine: ['src', 'lint'] },
        },
        { file: 'src/standard/platforms/next.ts', settings: { spine: ['app', 'src'], tool: 'b' } },
    ],
    package: '@jterrazz/typescript',
    settings: { roster: ['x'], spine: ['src', 'lint', 'app'], tool: 'b' },
};

describe('originLines', () => {
    test('origins — names the file each setting comes from, by setting, in the merge order', () => {
        // Given - a base merged from three files, a listed preset with no origins, and the project's own settings
        const { problem, resolved } = resolveConfig(
            {
                presets: [{ name: 'test', package: '@acme/test', settings: { roots: ['specs'] } }],
                test: { roots: ['e2e'] },
                typescript: { roots: { scripts: 'the release scripts' }, tool: 'c' },
            },
            () => [BASE],
        );

        // Then - list items from one file on one line, the first file that added an item keeps it, a single value the last that wrote it
        expect(problem).toBeNull();
        expect(
            originLines(resolved).filter(({ setting }) => !setting.startsWith('law ')),
        ).toStrictEqual([
            { origin: '@acme/test preset test', setting: 'test.roots = ["specs"]' },
            { origin: 'jterrazz.config.ts', setting: 'test.roots = ["e2e"]' },
            {
                origin: 'jterrazz.config.ts',
                setting: 'typescript.roots.scripts = "the release scripts"',
            },
            {
                origin: '@jterrazz/typescript src/standard/standard.ts',
                setting: 'typescript.roster = ["x"]',
            },
            {
                origin: '@jterrazz/typescript src/standard/standard.ts',
                setting: 'typescript.spine = ["src", "lint"]',
            },
            {
                origin: '@jterrazz/typescript src/standard/platforms/next.ts',
                setting: 'typescript.spine = ["app"]',
            },
            { origin: 'jterrazz.config.ts', setting: 'typescript.tool = "c"' },
        ]);
    });

    test('origins — names the file each law comes from, the preset where no file declares it, and each law set aside', () => {
        // Given - the base's law declared by its second file, a preset whose files declare none of its laws, one with no files, one holding a name rule alone, and an opt-out
        const { resolved } = resolveConfig(
            {
                optOuts: { 'typescript/base-law': 'the reason' },
                presets: [
                    {
                        layers: [layer('filed-law')],
                        name: 'filed',
                        origins: [{ file: 'src/standard/standard.ts', settings: {} }],
                        package: '@acme/filed',
                    },
                    { layers: [layer('bare-law')], name: 'bare', package: '@acme/bare' },
                    {
                        name: 'named',
                        names: [{ ...layer('named-law'), ls: {} }],
                        package: '@acme/named',
                    },
                ],
            },
            () => [BASE],
        );

        // Then - each law beside its file, or its preset
        expect(
            originLines(resolved).filter(({ setting }) => !setting.startsWith('typescript.')),
        ).toStrictEqual([
            {
                origin: '@jterrazz/typescript src/standard/standard.ts',
                setting: 'law typescript/base-law',
            },
            { origin: '@acme/filed preset filed', setting: 'law filed/filed-law' },
            { origin: '@acme/bare preset bare', setting: 'law bare/bare-law' },
            { origin: '@acme/named preset named', setting: 'law named/named-law' },
            { origin: 'jterrazz.config.ts', setting: 'optOut typescript/base-law = "the reason"' },
        ]);
    });
});
