import { describe, expect, test } from 'vitest';

import { objectOf } from './json.js';
import { BASE, BASE_OF, layer, REFUSED } from './preset.fixtures.js';
import type { Preset } from './preset.js';
import { resolveConfig } from './preset.js';

describe('preset', () => {
    test('orders the base first, then each preset after the presets it includes, then the repository', () => {
        // Given - a preset including another, and the repository's own layer
        const included: Preset = {
            layers: [layer('included-law')],
            name: 'core',
            package: '@acme/core',
        };
        const listed: Preset = {
            layers: [layer('listed-law')],
            name: 'web',
            package: '@acme/web',
            presets: [included],
        };

        // When - the settings are resolved
        const { problem, resolved } = resolveConfig(
            { presets: [listed], typescript: { architecture: { layers: [layer('own-law')] } } },
            BASE_OF,
        );

        // Then - the laws follow the merge order, the repository's last
        expect(problem).toBeNull();
        expect(resolved.presets.map(({ name }) => name)).toStrictEqual([
            'typescript',
            'core',
            'web',
        ]);
        expect(resolved.layers.map((rule) => objectOf(rule).name)).toStrictEqual([
            'base-law',
            'included-law',
            'listed-law',
            'own-law',
        ]);
    });

    test('merges a section over its defaults: records merge, a written value wins', () => {
        // Given - the base named with another profile, and the repository keeping a root and restating the spine
        const { resolved } = resolveConfig(
            {
                presets: [
                    {
                        name: 'typescript',
                        package: '@jterrazz/typescript',
                        settings: { profile: 'next' },
                    },
                ],
                typescript: { roots: { scripts: 'the release scripts' }, spine: ['src'] },
            },
            BASE_OF,
        );

        // Then - the written profile replaced the default, and the spine is the preset's
        expect(resolved.sections.typescript).toStrictEqual({
            profile: 'next',
            roots: { scripts: 'the release scripts' },
            spine: ['src'],
        });
    });

    test('merges the settings of the base preset listed inside another preset', () => {
        // Given - the base named with another profile by a preset the repository lists
        const { problem, resolved } = resolveConfig(
            {
                presets: [
                    {
                        name: 'web',
                        package: '@acme/web',
                        presets: [{ ...BASE, settings: { profile: 'next' } }],
                    },
                ],
            },
            BASE_OF,
        );

        // Then - the nested profile is chosen, and the base comes first
        expect(problem).toBeNull();
        expect(resolved.sections.typescript?.profile).toBe('next');
        expect(resolved.presets.map(({ name }) => name)).toStrictEqual(['typescript', 'web']);
        expect(resolved.laws).toStrictEqual(['typescript/base-law']);
    });

    test('sets a law aside only with its reason, and names the law it set aside', () => {
        // Given - one opt-out with its reason, one with none, one naming nothing
        const reasoned = resolveConfig(
            { optOuts: { 'typescript/base-law': 'until it moves' } },
            BASE_OF,
        );
        const unreasoned = resolveConfig({ optOuts: { 'typescript/base-law': ' ' } }, BASE_OF);
        const unknown = resolveConfig({ optOuts: { 'typescript/no-such-law': 'why' } }, BASE_OF);

        // Then - the reasoned one drops the law and is counted; the others are refused, the base laws still standing
        expect(reasoned.resolved.layers).toStrictEqual([]);
        expect(reasoned.resolved.optOuts).toStrictEqual([
            { law: 'typescript/base-law', reason: 'until it moves' },
        ]);
        expect(unreasoned.problem).toMatch(/with no reason/u);
        expect(unknown.problem).toMatch(/which no preset declares/u);
        expect(unknown.resolved.layers).toHaveLength(1);
    });

    test('refuses two presets of one name from two packages', () => {
        // Given - two presets named alike by two packages
        const { problem } = resolveConfig(
            {
                presets: [
                    { name: 'core', package: '@a/core' },
                    { name: 'core', package: '@b/core' },
                ],
            },
            BASE_OF,
        );

        // Then - the collision is named
        expect(problem).toBe('holds two presets named `core`, from @a/core and @b/core');
    });

    test.each([
        ['the base named with no law', { name: 'typescript', package: '@jterrazz/typescript' }],
        ['the base named with its laws emptied', { ...BASE, layers: [], names: [] }],
    ])('keeps the base laws where a listing names %s', (_, listed) => {
        // Given - a listing of the base preset that carries none of its laws
        const { problem, resolved } = resolveConfig({ presets: [listed] }, BASE_OF);

        // Then - the base law still stands, and nothing is set aside
        expect(problem).toBeNull();
        expect(resolved.laws).toStrictEqual(['typescript/base-law']);
        expect(resolved.layers.map((rule) => objectOf(rule).name)).toStrictEqual(['base-law']);
        expect(resolved.optOuts).toStrictEqual([]);
    });

    test.each(REFUSED)('refuses %s, the base laws still standing', (_, written, refused) => {
        // Given - a settings object that would write a base law away
        // When - the settings are resolved
        const { problem, resolved } = resolveConfig(written, BASE_OF);

        // Then - the problem is named, and the base law is still held
        expect(problem).toBe(refused);
        expect(resolved.laws).toStrictEqual(['typescript/base-law']);
    });

    test('follows the presets a listed copy of the base includes, and reads no layer or name that is not a list', () => {
        // Given - the base listed with a preset of its own, and a repository writing its layers and names as single values
        const { problem, resolved } = resolveConfig(
            {
                presets: [
                    {
                        ...BASE,
                        presets: [
                            { layers: [layer('extra-law')], name: 'extra', package: '@x/extra' },
                        ],
                    },
                ],
                typescript: { architecture: { layers: 'own-law' }, names: 'own-name' },
            },
            BASE_OF,
        );

        // Then - the base keeps its first place, its listed copy's preset follows, and the single values are read as nothing
        expect(problem).toBeNull();
        expect(resolved.presets.map(({ name }) => name)).toStrictEqual(['typescript', 'extra']);
        expect([resolved.layers.map((rule) => objectOf(rule).name), resolved.names]).toStrictEqual([
            ['base-law', 'extra-law'],
            [],
        ]);
    });

    test('keeps each section to its own preset and the repository, and gathers baselines and names laws', () => {
        // Given - a preset with its own section, a baseline and a names law, and a repository section no preset owns
        const names = {
            fix: 'fix',
            ls: {},
            name: 'web-names',
            read: 'docs/a.md#b' as const,
            why: 'why',
        };
        const { problem, resolved } = resolveConfig(
            {
                knip: { entry: ['scripts/run.ts'] },
                presets: [
                    {
                        baseline: ['web.json'],
                        name: 'web',
                        names: [names],
                        package: '@acme/web',
                        settings: { mode: 'strict' },
                    },
                ],
            },
            BASE_OF,
        );

        // Then - each section holds its own settings alone, and the preset's baseline and law are gathered
        expect(problem).toBeNull();
        expect([
            resolved.sections.web,
            resolved.sections.knip,
            resolved.baseline,
            resolved.names,
        ]).toStrictEqual([
            { mode: 'strict' },
            { entry: ['scripts/run.ts'] },
            ['web.json'],
            [names],
        ]);
        expect(resolved.laws).toStrictEqual(['typescript/base-law', 'web/web-names']);
    });

    test('resolves a base that refuses itself to nothing', () => {
        // Given - a base declaring two presets of one name from two packages
        const { problem, resolved } = resolveConfig({}, () => [
            BASE,
            { ...BASE, package: 'other' },
        ]);

        // Then - the collision is named, and no law is held
        expect(problem).toBe(
            'holds two presets named `typescript`, from @jterrazz/typescript and other',
        );
        expect(resolved.laws).toStrictEqual([]);
    });
});
