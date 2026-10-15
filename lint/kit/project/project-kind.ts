import { isJsonObject } from './json.js';

export const KINDS = ['library', 'api', 'cli', 'website', 'mobile'] as const;

export const PLATFORMS = ['node', 'bun', 'react', 'next', 'astro', 'expo', 'browser'] as const;

export type ProjectKind = (typeof KINDS)[number];

export type Platform = (typeof PLATFORMS)[number];

export type ProjectDeclaration =
    | { kind: 'api'; platform: 'bun' | 'node' }
    | { kind: 'cli'; platform: 'bun' | 'node' }
    | { kind: 'library'; platform: Platform }
    | { kind: 'mobile'; platform: 'expo' }
    | { kind: 'website'; platform: 'astro' | 'browser' | 'next' | 'react' }
    | { kind?: undefined; platform?: 'bun' | 'node' };

type PlatformsOf = {
    readonly [Kind in ProjectKind]: readonly Extract<
        ProjectDeclaration,
        { kind: Kind }
    >['platform'][];
};

export const PLATFORMS_OF: PlatformsOf = {
    api: ['node', 'bun'],
    cli: ['node', 'bun'],
    library: PLATFORMS,
    mobile: ['expo'],
    website: ['react', 'next', 'astro', 'browser'],
};

/** `kind: null` is a monorepo's own suite: a member of tests alone, which is no product and so declares no kind. */
export type ProjectIdentity = { kind: null | ProjectKind; platform: Platform };

/** The platforms a suite's tests run on. */
export const SUITE_PLATFORMS: readonly Platform[] = ['node', 'bun'];

/** The one folder a kind-less member may be: the monorepo root's own `specs/`. */
export const SUITE_FOLDER = 'specs';

export type Publication = 'private' | 'published';

export const PUBLICATION: Readonly<Record<ProjectKind, Publication>> = Object.freeze({
    api: 'private',
    cli: 'published',
    library: 'published',
    mobile: 'private',
    website: 'private',
});

const PUBLISHED_KINDS: ReadonlySet<unknown> = new Set(
    KINDS.filter((kind) => PUBLICATION[kind] === 'published'),
);

/** A kind that publishes is published unless its manifest says `"private": true`: a monorepo's internal library, a binary compiled and installed by hand. */
export const publishes = (
    identity: null | ProjectIdentity | undefined,
    manifest: Readonly<Record<string, unknown>>,
): boolean => PUBLISHED_KINDS.has(identity?.kind) && manifest.private !== true;

/** A declaration as a sentence reads it: `library on node`, `a suite on bun`. */
export const declaredAs = ({ kind, platform }: ProjectIdentity): string =>
    `${kind ?? 'a suite'} on ${platform}`;

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
    if (kind === undefined && runsOn(SUITE_PLATFORMS, platform)) {
        return { declaration: { kind: null, platform }, problem: null };
    }
    if (!isKind(kind)) {
        return {
            declaration: null,
            problem: `declares the kind \`${String(kind)}\`, which is none of ${listed(KINDS)}`,
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
