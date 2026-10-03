import { describe, expect, test } from 'vitest';

import { objectOf } from './json.js';
import { resolveConfig } from './preset.js';
import type { ArchitectureRule, Preset } from './preset.js';

const layer = (name: string): ArchitectureRule => ({
    fix: 'fix',
    from: { path: '^src/' },
    name,
    read: 'docs/a.md#b',
    to: { path: '^lint/' },
    why: 'why',
});

const BASE: Preset = {
    lawSettings: ['spine'],
    layers: [layer('base-law')],
    name: 'typescript',
    package: '@jterrazz/typescript',
    settings: { profile: 'node', spine: ['src'] },
};

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
            [BASE],
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
            [BASE],
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
            [BASE],
        );

        // Then - the nested profile is chosen, and the base comes first
        expect(problem).toBeNull();
        expect(resolved.sections.typescript?.profile).toBe('next');
        expect(resolved.presets.map(({ name }) => name)).toStrictEqual(['typescript', 'web']);
    });

    test('sets a law aside only with its reason, and names the law it set aside', () => {
        // Given - one opt-out with its reason, one with none, one naming nothing
        const reasoned = resolveConfig({ optOuts: { 'typescript/base-law': 'until it moves' } }, [
            BASE,
        ]);
        const unreasoned = resolveConfig({ optOuts: { 'typescript/base-law': ' ' } }, [BASE]);
        const unknown = resolveConfig({ optOuts: { 'typescript/no-such-law': 'why' } }, [BASE]);

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
            [BASE],
        );

        // Then - the collision is named
        expect(problem).toBe('holds two presets named `core`, from @a/core and @b/core');
    });

    test.each([
        ['the base named with no law', { name: 'typescript', package: '@jterrazz/typescript' }],
        ['the base named with its laws emptied', { ...BASE, layers: [], names: [] }],
    ])('keeps the base laws where a listing names %s', (_, listed) => {
        // Given - a listing of the base preset that carries none of its laws
        const { problem, resolved } = resolveConfig({ presets: [listed] }, [BASE]);

        // Then - the base law still stands, and nothing is set aside
        expect(problem).toBeNull();
        expect(resolved.laws).toStrictEqual(['typescript/base-law']);
        expect(resolved.layers.map((rule) => objectOf(rule).name)).toStrictEqual(['base-law']);
        expect(resolved.optOuts).toStrictEqual([]);
    });

    test.each([
        [
            'the base named by another package',
            { presets: [{ name: 'typescript', package: 'other' }] },
            'holds two presets named `typescript`, from @jterrazz/typescript and other',
        ],
        [
            'a list written away as null',
            { typescript: { spine: null } },
            'writes a single value at `typescript.spine`, where its presets set a list — a setting adds to a default, never replaces its shape',
        ],
        [
            'a list written away through the listed base',
            { presets: [{ ...BASE, settings: { spine: 'src' } }] },
            'writes a single value at `typescript.spine`, where its presets set a list — a setting adds to a default, never replaces its shape',
        ],
        [
            'presets listed inside a section',
            { typescript: { presets: [] } },
            'holds a `presets` inside its `typescript` section, which no reader reads — list every preset at the top level, `presets: [...]`',
        ],
        [
            'a law setting extended by the repository',
            { typescript: { spine: ['scripts'] } },
            'writes `typescript.spine`, a law the typescript preset sets — keep a root beside the spine under `typescript.roots` with its reason, or set a law aside under `optOuts`',
        ],
        [
            'a law setting extended through a nested listing of the base',
            {
                presets: [
                    {
                        name: 'web',
                        package: '@acme/web',
                        presets: [{ ...BASE, settings: { spine: ['scripts'] } }],
                    },
                ],
            },
            'writes `typescript.spine`, a law the typescript preset sets — keep a root beside the spine under `typescript.roots` with its reason, or set a law aside under `optOuts`',
        ],
    ])('refuses %s, the base laws still standing', (_, written, refused) => {
        // Given - a settings object that would write a base law away
        // When - the settings are resolved
        const { problem, resolved } = resolveConfig(written, [BASE]);

        // Then - the problem is named, and the base law is still held
        expect(problem).toBe(refused);
        expect(resolved.laws).toStrictEqual(['typescript/base-law']);
    });
});
