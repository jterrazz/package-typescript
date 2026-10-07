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
