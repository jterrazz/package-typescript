import { isJsonObject } from '../../kit/project/json.js';
import { PUBLICATION } from '../../kit/project/project-kind.js';
import type { ProjectKind } from '../../kit/project/project-kind.js';

export const NAMED: Readonly<Record<ProjectKind, string>> = {
    api: 'an api',
    cli: 'a cli',
    library: 'a library',
    mobile: 'a mobile app',
    website: 'a website',
    workspace: 'a workspace',
};

const isEmpty = (value: unknown): boolean =>
    value === undefined || (isJsonObject(value) && Object.keys(value).length === 0);

const SUITE_GAP = {
    fix: 'set `"private": true`: a suite is never published',
    owes: 'is not `private`, so npm would publish the suite',
};

// invariant: a private cli is a binary its repository builds and installs itself, compiled or not: it owes no `bin`.
function publishedGap(
    kind: ProjectKind,
    manifest: Readonly<Record<string, unknown>>,
): null | { fix: string; owes: string } {
    if (kind !== 'workspace' && manifest.workspaces !== undefined) {
        return {
            fix: 'move the members under `apps/` or `packages/` of a repository declared a `workspace`, so each is measured on its own, or drop `workspaces`',
            owes: 'declares `workspaces`, which only a workspace has: its own sources would be read as a member of itself',
        };
    }
    if (kind === 'library' && manifest.exports === undefined && manifest.main === undefined) {
        return {
            fix: 'publish what the library offers in `exports`, or declare the kind the project is',
            owes: 'publishes no `exports`',
        };
    }
    if (kind === 'cli' && manifest.private !== true && isEmpty(manifest.bin)) {
        return {
            fix: 'name the command in `bin`, set `"private": true` when the repository installs the binary itself, or declare the kind the project is',
            owes: 'names no `bin`',
        };
    }
    if (PUBLICATION[kind] === 'private' && manifest.private !== true) {
        return {
            fix: 'set `"private": true`, or declare the kind the project is',
            owes: 'is not `private`, so npm would publish the application',
        };
    }

    return null;
}

/** `null` is a workspace's own suite, which declares no kind and is never published. */
export function manifestGap(
    kind: null | ProjectKind,
    manifest: Readonly<Record<string, unknown>>,
): null | { fix: string; owes: string } {
    if (kind !== null) {
        return publishedGap(kind, manifest);
    }

    return manifest.private === true ? null : SUITE_GAP;
}

// outside: the top-level fields npm, the package managers and the tools of the family read from a manifest; a key beyond them reads nothing, and a typo of one fails silently.
const KNOWN_KEYS: ReadonlySet<string> = new Set([
    'author',
    'browser',
    'browserslist',
    'bugs',
    'bin',
    'bundleDependencies',
    'bundledDependencies',
    'config',
    'contributors',
    'cpu',
    'dependencies',
    'description',
    'devDependencies',
    'devEngines',
    'directories',
    'engines',
    'exports',
    'files',
    'funding',
    'homepage',
    'imports',
    'keywords',
    'libc',
    'license',
    'main',
    'man',
    'module',
    'name',
    'optionalDependencies',
    'os',
    'overrides',
    'packageManager',
    'patchedDependencies',
    'peerDependencies',
    'peerDependenciesMeta',
    'pnpm',
    'private',
    'publishConfig',
    'repository',
    'resolutions',
    'scripts',
    'sideEffects',
    'trustedDependencies',
    'type',
    'types',
    'typings',
    'version',
    'volta',
    'workspaces',
]);

/** The top-level keys of a manifest that nothing reads: `$`-keys and `_`-keys are comments by convention. */
export function unknownManifestKeys(manifest: Readonly<Record<string, unknown>>): string[] {
    return Object.keys(manifest).filter(
        (key) => !KNOWN_KEYS.has(key) && !key.startsWith('$') && !key.startsWith('_'),
    );
}
