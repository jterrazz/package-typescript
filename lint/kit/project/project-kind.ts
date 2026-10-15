import { isJsonObject } from './json.js';

export const KINDS = ['library', 'api', 'cli', 'website', 'mobile', 'content'] as const;

export const PLATFORMS = ['node', 'bun', 'react', 'next', 'astro', 'expo', 'browser'] as const;

export type ProjectKind = (typeof KINDS)[number];

/** The kinds that run code: every kind but `content`, a repository holding no code to build, type or lint. */
export type CodeKind = Exclude<ProjectKind, 'content'>;

export const CODE_KINDS: readonly CodeKind[] = KINDS.filter(
    (kind): kind is CodeKind => kind !== 'content',
);

export type Platform = (typeof PLATFORMS)[number];

export type ProjectDeclaration =
    | { kind: 'api'; platform: 'bun' | 'node' }
    | { kind: 'cli'; platform: 'bun' | 'node' }
    | { kind: 'content'; platform?: undefined }
    | { kind: 'library'; platform: Platform }
    | { kind: 'mobile'; platform: 'expo' }
    | { kind: 'website'; platform: 'astro' | 'browser' | 'next' | 'react' }
    | { kind?: undefined; platform?: 'bun' | 'node' };

type PlatformsOf = {
    readonly [Kind in CodeKind]: readonly Extract<ProjectDeclaration, { kind: Kind }>['platform'][];
};

export const PLATFORMS_OF: PlatformsOf = {
    api: ['node', 'bun'],
    cli: ['node', 'bun'],
    library: PLATFORMS,
    mobile: ['expo'],
    website: ['react', 'next', 'astro', 'browser'],
};

/** The platform a content repository is read on, where a pass needs one: it declares none, and runs no JS pass that would use it. */
export const CONTENT_PLATFORM: Platform = 'node';

/** `kind: null` is a monorepo's own suite: a member of tests alone, which is no product and so declares no kind. */
export type ProjectIdentity = { kind: null | ProjectKind; platform: Platform };

/** The platforms a suite's tests run on. */
export const SUITE_PLATFORMS: readonly Platform[] = ['node', 'bun'];

/** The one folder a kind-less member may be: the monorepo root's own `specs/`. */
export const SUITE_FOLDER = 'specs';

export type Publication = 'private' | 'published';

export const PUBLICATION: Readonly<Record<CodeKind, Publication>> = Object.freeze({
    api: 'private',
    cli: 'published',
    library: 'published',
    mobile: 'private',
    website: 'private',
});

const PUBLISHED_KINDS: ReadonlySet<unknown> = new Set(
    CODE_KINDS.filter((kind) => PUBLICATION[kind] === 'published'),
);

/** A kind that publishes is published unless its manifest says `"private": true`: a monorepo's internal library, a binary compiled and installed by hand. */
export const publishes = (
    identity: null | ProjectIdentity | undefined,
    manifest: Readonly<Record<string, unknown>>,
): boolean => PUBLISHED_KINDS.has(identity?.kind) && manifest.private !== true;

/** A declaration as a sentence reads it: `library on node`, `a suite on bun`. */
export const declaredAs = ({ kind, platform }: ProjectIdentity): string =>
    kind === 'content' ? 'content' : `${kind ?? 'a suite'} on ${platform}`;

const isKind = (value: unknown): value is ProjectKind =>
    (KINDS as readonly unknown[]).includes(value);

const runsOn = (allowed: readonly Platform[], value: unknown): value is Platform =>
    (allowed as readonly unknown[]).includes(value);

export const listed = (values: readonly string[]): string =>
    values.map((one) => `\`${one}\``).join(', ');

/** The declaration a content repository keeps when its settings are refused: it stays content, and the passes that run stay the content ones. */
export const CONTENT_DECLARED = Object.freeze({ kind: 'content' });

/** A content declaration is read even when it holds a platform: the problem is named, and the passes that run stay the content ones. */
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
    if (kind === 'content') {
        const declaration = { kind, platform: CONTENT_PLATFORM };

        return platform === undefined
            ? { declaration, problem: null }
            : {
                  declaration,
                  problem: `declares a \`content\` repository on the platform \`${typeof platform === 'string' ? platform : 'of no name'}\`, which runs no code and so declares none`,
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
