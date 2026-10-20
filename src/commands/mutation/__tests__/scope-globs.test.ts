import { describe, expect, test } from 'vitest';

import { resolveConfig } from '../../../../lint/kit/project/preset.js';
import type { Preset } from '../../../../lint/kit/project/preset.js';
import { declaredOf, extensionGlob, prefixOf, sourceGlobsOf } from '../scope-globs.js';

const presetWith = (name: string, sources?: Preset['sources']): Preset => ({
    name,
    package: `@acme/${name}`,
    ...(sources === undefined ? {} : { sources }),
});

describe('scope-globs', () => {
    test('extensionGlob — one extension is itself, several are a brace list', () => {
        // Given - one extension of each kind and two
        // Then - a lone extension stands bare, whatever it is; several are braced
        expect([
            extensionGlob(['ts']),
            extensionGlob(['tsx']),
            extensionGlob(['ts', 'tsx']),
            extensionGlob([]),
        ]).toStrictEqual(['ts', 'tsx', '{ts,tsx}', '{}']);
    });

    test('prefixOf — the root unit has no prefix, a member is its folder', () => {
        // Given - the root and a member
        // Then - nothing before a root's globs, the member's folder before its own
        expect([prefixOf('.'), prefixOf('apps/api')]).toStrictEqual(['', 'apps/api/']);
    });

    test('sourceGlobsOf — every root of every preset that names sources, for its extensions, under the unit’s folder', () => {
        // Given - a resolution of a preset with two roots and one extension, a preset naming none, and one with two extensions
        const { resolved } = resolveConfig(
            {
                presets: [
                    presetWith('first', { extensions: ['tsx'], roots: ['src', 'app'] }),
                    presetWith('second'),
                    presetWith('third', { extensions: ['ts', 'tsx'], roots: ['lib'] }),
                ],
            },
            () => [],
        );

        // Then - a glob per root, braced where an unit has two extensions, prefixed in a member
        expect([
            sourceGlobsOf('.', { problem: null, resolved }),
            sourceGlobsOf('apps/api', { problem: null, resolved }),
        ]).toStrictEqual([
            ['src/**/*.tsx', 'app/**/*.tsx', 'lib/**/*.{ts,tsx}'],
            ['apps/api/src/**/*.tsx', 'apps/api/app/**/*.tsx', 'apps/api/lib/**/*.{ts,tsx}'],
        ]);
    });

    test('declaredOf — the globs a unit declares under exclude, glue, ignore and mutate, each under its folder, and none where it declares none', () => {
        // Given - a section declaring the three, and one declaring nothing
        const declares = resolveConfig(
            {
                typescript: {
                    mutation: {
                        exclude: { 'specs/a.ts': 'why' },
                        glue: { 'src/adapters/**': 'why' },
                        ignore: { 'src/standard/**': 'data' },
                        mutate: { 'scripts/*.ts': 'why' },
                    },
                },
            },
            () => [],
        ).resolved;
        const silent = resolveConfig({}, () => []).resolved;

        // Then - each key to its own list, prefixed in a member; nothing from a unit that states none
        expect([
            declaredOf('.', { problem: null, resolved: declares }),
            declaredOf('apps/api', { problem: null, resolved: declares }),
            declaredOf('.', { problem: null, resolved: silent }),
        ]).toStrictEqual([
            {
                exclude: ['specs/a.ts'],
                glue: ['src/adapters/**'],
                ignore: ['src/standard/**'],
                mutated: ['scripts/*.ts'],
            },
            {
                exclude: ['apps/api/specs/a.ts'],
                glue: ['apps/api/src/adapters/**'],
                ignore: ['apps/api/src/standard/**'],
                mutated: ['apps/api/scripts/*.ts'],
            },
            { exclude: [], glue: [], ignore: [], mutated: [] },
        ]);
    });
});
