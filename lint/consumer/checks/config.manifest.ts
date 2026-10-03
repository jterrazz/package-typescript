import { PUBLICATION } from '../../kit/project/declaration.js';
import type { ProjectKind } from '../../kit/project/declaration.js';
import { isJsonObject } from '../../kit/project/json.js';

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

export function manifestGap(
    kind: ProjectKind | undefined,
    manifest: Readonly<Record<string, unknown>>,
): null | { fix: string; owes: string } {
    if (kind === 'library' && manifest.exports === undefined && manifest.main === undefined) {
        return {
            fix: 'publish what the library offers in `exports`, or declare the kind the project is',
            owes: 'publishes no `exports`',
        };
    }
    if (kind === 'cli' && isEmpty(manifest.bin)) {
        return {
            fix: 'name the command in `bin`, or declare the kind the project is',
            owes: 'names no `bin`',
        };
    }
    if (kind !== undefined && PUBLICATION[kind] === 'private' && manifest.private !== true) {
        return {
            fix: 'set `"private": true`, or declare the kind the project is',
            owes: 'is not `private`, so npm would publish the application',
        };
    }

    return null;
}
