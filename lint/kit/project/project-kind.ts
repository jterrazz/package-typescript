import { isJsonObject } from './json.js';

export const KINDS = ['library', 'api', 'cli', 'website', 'mobile', 'workspace'] as const;

export const PLATFORMS = ['node', 'bun', 'react', 'next', 'astro', 'expo'] as const;

export type ProjectKind = (typeof KINDS)[number];

export type Platform = (typeof PLATFORMS)[number];

export type ProjectDeclaration =
    | { kind: 'api'; platform: 'bun' | 'node' }
    | { kind: 'cli'; platform: 'bun' | 'node' }
    | { kind: 'library'; platform: Platform }
    | { kind: 'mobile'; platform: 'expo' }
    | { kind: 'website'; platform: 'astro' | 'next' | 'react' }
    | { kind: 'workspace' };

type PlatformsOf = {
    readonly [Kind in Exclude<ProjectKind, 'workspace'>]: readonly Extract<
        ProjectDeclaration,
        { kind: Kind }
    >['platform'][];
};

export const PLATFORMS_OF: PlatformsOf = {
    api: ['node', 'bun'],
    cli: ['node', 'bun'],
    library: PLATFORMS,
    mobile: ['expo'],
    website: ['react', 'next', 'astro'],
};

export type ProjectIdentity = { kind: ProjectKind; platform: null | Platform };

export type Publication = 'members' | 'private' | 'published';

export const PUBLICATION: Readonly<Record<ProjectKind, Publication>> = Object.freeze({
    api: 'private',
    cli: 'published',
    library: 'published',
    mobile: 'private',
    website: 'private',
    workspace: 'members',
});

export const publishes = (identity: null | ProjectIdentity | undefined): boolean =>
    identity !== null && identity !== undefined && PUBLICATION[identity.kind] === 'published';

const isKind = (value: unknown): value is ProjectKind =>
    (KINDS as readonly unknown[]).includes(value);

const runsOn = (allowed: readonly Platform[], value: unknown): value is Platform =>
    (allowed as readonly unknown[]).includes(value);

export const listed = (values: readonly string[]): string =>
    values.map((one) => `\`${one}\``).join(', ');

export type ProjectKindRead = { declaration: null | ProjectIdentity; problem: null | string };

export function readProjectKind(declared: object): ProjectKindRead {
    const { kind, platform } = isJsonObject(declared) ? declared : {};
    if (kind === undefined && platform === undefined) {
        return { declaration: null, problem: null };
    }
    if (!isKind(kind)) {
        return {
            declaration: null,
            problem: `declares the kind \`${String(kind)}\`, which is none of ${listed(KINDS)}`,
        };
    }
    if (kind === 'workspace') {
        return platform === undefined
            ? { declaration: { kind, platform: null }, problem: null }
            : {
                  declaration: null,
                  problem:
                      'declares a `platform` for a workspace, whose members each declare their own',
              };
    }
    const allowed: readonly Platform[] = PLATFORMS_OF[kind];
    if (!runsOn(allowed, platform)) {
        return {
            declaration: null,
            problem: `declares a \`${kind}\` on the platform \`${String(platform)}\`, where a ${kind} runs on ${listed(allowed)}`,
        };
    }

    return { declaration: { kind, platform }, problem: null };
}
