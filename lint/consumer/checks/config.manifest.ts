import { join } from 'node:path';

import type { Context, Finding } from '../../kit/checker/pass.js';
import { isJsonObject, parsedObject } from '../../kit/project/json.js';
import { SETTINGS_FILE } from '../../kit/project/jterrazz-config.js';
import { PUBLICATION } from '../../kit/project/project-kind.js';
import type { ProjectKind } from '../../kit/project/project-kind.js';
import { configFinding as finding, prefixed } from './config.finding.js';

export const NAMED: Readonly<Record<ProjectKind, string>> = {
    api: 'an api',
    cli: 'a cli',
    library: 'a library',
    mobile: 'a mobile app',
    website: 'a website',
    // Stryker disable next-line StringLiteral: a workspace owes its manifest nothing a finding could name it for, so the entry completes the table and is read by no message
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

/** The top-level keys of a manifest that nothing the standard names reads: `$`-keys and `_`-keys are comments by convention. */
export function unknownManifestKeys(
    manifest: Readonly<Record<string, unknown>>,
    known: ReadonlySet<string>,
): string[] {
    return Object.keys(manifest).filter(
        (key) => !known.has(key) && !key.startsWith('$') && !key.startsWith('_'),
    );
}

function manifestOf(context: Context, unit: string): Readonly<Record<string, unknown>> {
    try {
        return parsedObject(context.read(join(context.root, unit, 'package.json')) ?? '{}');
    } catch {
        return {};
    }
}

export function manifestFindings(
    context: Context,
    unit: string,
    kind: null | ProjectKind,
    known: ReadonlySet<string>,
): Finding[] {
    const manifest = manifestOf(context, unit);
    const gap = manifestGap(kind, manifest);
    const path = prefixed(unit, 'package.json');
    const strays = unknownManifestKeys(manifest, known);

    return [
        ...(gap === null
            ? []
            : [
                  finding('config/kind-matches-manifest', path, {
                      fix: gap.fix,
                      found: `${prefixed(unit, SETTINGS_FILE)} declares ${kind === null ? 'no kind, a suite' : NAMED[kind]}, and ${path} ${gap.owes}`,
                  }),
              ]),
        ...(manifest.type === 'module'
            ? []
            : [
                  finding('config/manifest-is-a-module', path, {
                      fix: 'set `"type": "module"`',
                      found: `${path} does not set \`"type": "module"\`, and the vitest config the toolchain derives and the names its build gives the files are ESM's`,
                  }),
              ]),
        ...(strays.length === 0
            ? []
            : [
                  finding('config/manifest-keys-known', path, {
                      fix: "fix the key if it is a typo of one npm reads, move a tool's settings to `jterrazz.config.ts`, or delete it; a key that carries information for a reader — a credit, a fork's origin — moves to the README",
                      found: `${path} holds ${strays.map((key) => `\`${key}\``).join(', ')}, which npm and the tools of the family read nowhere`,
                  }),
              ]),
    ];
}
