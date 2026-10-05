import type { OxlintConfig } from 'oxlint';
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

const RULEBOOK: OxlintConfig = {
    jsPlugins: ['jterrazz-typescript'],
    overrides: [{ files: ['**/*.test.ts'], rules: { 'max-lines': 'off' } }],
    rules: { eqeqeq: 'error', 'no-console': 'error' },
    settings: { react: { version: '19' } },
};

describe('origins', () => {
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
                origin: '@jterrazz/typescript rulebook',
                setting: 'typescript.oxlint.profile = "node"',
            },
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

    test('origins — names the oxlint fragment of the rulebook and of each preset, what the tree derives, and an empty default no file fills', () => {
        // Given - a preset stating empty defaults and an oxlint fragment, a project filling one default and adding its own override, and projects derived from the tree
        const { problem, resolved } = resolveConfig(
            {
                kind: 'website',
                platform: 'next',
                presets: [
                    {
                        name: 'test',
                        oxlint: {
                            jsPlugins: ['@acme/test/oxlint'],
                            overrides: [{ files: ['specs/**'], rules: { 'acme/spec': 'error' } }],
                        },
                        package: '@acme/test',
                        settings: { allow: {}, roots: [], words: [] },
                    },
                ],
                test: { allow: { vitest: 'the runtime ships' }, roots: ['e2e'] },
                typescript: {
                    oxlint: {
                        overrides: [{ files: ['scripts/**'], rules: { 'no-console': 'off' } }],
                    },
                },
            },
            () => [],
        );

        // Then - the derived projects first, each preset's fragment before the project's own, and the empty default only where nothing fills it
        expect(problem).toBeNull();
        expect(
            originLines(resolved, {
                derived: { test: { projects: { api: {}, unit: { roots: ['src'] } } } },
            }),
        ).toStrictEqual([
            { origin: 'jterrazz.config.ts', setting: 'test.allow.vitest = "the runtime ships"' },
            { origin: 'derived from the tree', setting: 'test.projects.api = {}' },
            { origin: 'derived from the tree', setting: 'test.projects.unit.roots = ["src"]' },
            { origin: 'jterrazz.config.ts', setting: 'test.roots = ["e2e"]' },
            { origin: '@acme/test preset test', setting: 'test.words = []' },
            {
                origin: '@acme/test preset test',
                setting: 'typescript.oxlint.jsPlugins = ["@acme/test/oxlint"]',
            },
            {
                origin: '@acme/test preset test',
                setting:
                    'typescript.oxlint.overrides = [{"files":["specs/**"],"rules":{"acme/spec":"error"}}]',
            },
            {
                origin: 'jterrazz.config.ts',
                setting:
                    'typescript.oxlint.overrides = [{"files":["scripts/**"],"rules":{"no-console":"off"}}]',
            },
            {
                origin: '@jterrazz/typescript rulebook',
                setting: 'typescript.oxlint.profile = "next"',
            },
        ]);
    });

    test('origins — a rule or a setting the rulebook or a preset sets is replaced whole by the last layer setting it, options and level together', () => {
        // Given - the rulebook's profile, then two presets setting one rule with options, the second also replacing a rule of the rulebook
        const { resolved } = resolveConfig(
            {
                presets: [
                    {
                        name: 'first',
                        oxlint: { rules: { 'acme/kind': ['error', { openings: ['a'] }] } },
                        package: '@acme/first',
                    },
                    {
                        name: 'second',
                        oxlint: {
                            rules: {
                                'acme/kind': ['error', { openings: ['a', 'b'] }],
                                'no-console': 'off',
                            },
                            settings: { react: { pragma: 'h' } },
                        },
                        package: '@acme/second',
                    },
                ],
                typescript: {},
            },
            () => [],
        );

        // Then - each rule on one line, beside the last layer that set it, the rulebook's other keys beside the rulebook
        expect(originLines(resolved, { rulebook: RULEBOOK })).toStrictEqual([
            {
                origin: '@jterrazz/typescript rulebook',
                setting: 'typescript.oxlint.jsPlugins = ["jterrazz-typescript"]',
            },
            {
                origin: '@jterrazz/typescript rulebook',
                setting:
                    'typescript.oxlint.overrides = [{"files":["**/*.test.ts"],"rules":{"max-lines":"off"}}]',
            },
            {
                origin: '@jterrazz/typescript rulebook',
                setting: 'typescript.oxlint.profile = "node"',
            },
            {
                origin: '@acme/second preset second',
                setting: 'typescript.oxlint.rules.acme/kind = ["error",{"openings":["a","b"]}]',
            },
            {
                origin: '@jterrazz/typescript rulebook',
                setting: 'typescript.oxlint.rules.eqeqeq = "error"',
            },
            {
                origin: '@acme/second preset second',
                setting: 'typescript.oxlint.rules.no-console = "off"',
            },
            {
                origin: '@acme/second preset second',
                setting: 'typescript.oxlint.settings.react = {"pragma":"h"}',
            },
        ]);
    });
});
