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

    test('merges a section over its defaults: lists concatenate, records merge, a written value wins', () => {
        // Given - the base named with another profile, and the repository adding to the spine
        const { resolved } = resolveConfig(
            {
                presets: [{ ...BASE, settings: { ...BASE.settings, profile: 'next' } }],
                typescript: { roots: { scripts: 'the release scripts' }, spine: ['tools', 'src'] },
            },
            [BASE],
        );

        // Then - the written profile replaced the default, and the spine grew without a duplicate
        expect(resolved.sections.typescript).toStrictEqual({
            profile: 'next',
            roots: { scripts: 'the release scripts' },
            spine: ['src', 'tools'],
        });
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
});
