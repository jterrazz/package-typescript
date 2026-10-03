import type { ArchitectureRule, Preset } from './preset.js';

export const layer = (name: string): ArchitectureRule => ({
    fix: 'fix',
    from: { path: '^src/' },
    name,
    read: 'docs/06-configuration.md#presets',
    to: { path: '^lint/' },
    why: 'why',
});

export const BASE: Preset = {
    lawSettings: ['spine'],
    layers: [layer('base-law')],
    name: 'typescript',
    package: '@jterrazz/typescript',
    settings: { profile: 'node', spine: ['src'] },
};

export const BASE_OF = (): readonly Preset[] => [BASE];

/** Settings each refused, with the problem each is refused with. */
export const REFUSED: [string, Record<string, unknown>, string][] = [
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
    [
        'an entry that is no object',
        { presets: ['web'] },
        'holds a `presets` entry that is not a preset — an object carrying its `name` and its `package`',
    ],
    [
        'an entry with an empty name',
        { presets: [{ name: '', package: '@acme/web' }] },
        'holds a `presets` entry that is not a preset — an object carrying its `name` and its `package`',
    ],
    [
        'an entry whose name is no string',
        { presets: [{ name: 1, package: '@acme/web' }] },
        'holds a `presets` entry that is not a preset — an object carrying its `name` and its `package`',
    ],
    [
        'an entry with no package',
        { presets: [{ name: 'web' }] },
        'holds a `presets` entry that is not a preset — an object carrying its `name` and its `package`',
    ],
    [
        'an entry that is no preset, nested in one',
        { presets: [{ name: 'web', package: '@acme/web', presets: [{ name: 'core' }] }] },
        'holds a `presets` entry that is not a preset — an object carrying its `name` and its `package`',
    ],
    ['a presets field that is no list', { presets: 'web' }, 'holds a `presets` that is not a list'],
    [
        'the base named by another package, writing a law',
        {
            presets: [{ name: 'typescript', package: 'other', settings: { spine: ['scripts'] } }],
        },
        'holds two presets named `typescript`, from @jterrazz/typescript and other',
    ],
    [
        'a section that is no object',
        { typescript: 'x' },
        'holds a `typescript` section that is not an object',
    ],
    [
        'a kind outside the vocabulary',
        { kind: 'nonsense' },
        'declares the kind `nonsense`, which is none of `library`, `api`, `cli`, `website`, `mobile`, `workspace`',
    ],
];
