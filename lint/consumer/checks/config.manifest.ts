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
};

/** What a unit is to its manifest: a project of its kind, a monorepo's own suite, or the root of a monorepo, which declares no kind. */
export type Role = 'monorepo' | 'suite' | ProjectKind;

const isEmpty = (value: unknown): boolean =>
    value === undefined || (isJsonObject(value) && Object.keys(value).length === 0);

const SUITE_GAP = {
    fix: 'set `"private": true`: a suite is never published',
    owes: 'is not `private`, so npm would publish the suite',
};

const MONOREPO_GAP = {
    fix: 'set `"private": true`, and publish what the repository ships from a member of its own under `packages/`',
    owes: 'is not `private`, so npm would publish the root of a monorepo, which is a container, never a project',
};

// invariant: a private cli is a binary its repository builds and installs itself, compiled or not: it owes no `bin`.
function publishedGap(
    kind: ProjectKind,
    manifest: Readonly<Record<string, unknown>>,
): null | { fix: string; owes: string } {
    if (manifest.workspaces !== undefined) {
        return {
            fix: `drop \`kind\` and \`platform\` from its ${SETTINGS_FILE} and move its sources into a member under \`apps/\` or \`packages/\` that declares its own, or drop \`workspaces\` when the repository is one project`,
            owes: 'declares `workspaces`, so it is the root of a monorepo, a container that declares no kind: its own sources would be read as a member of itself',
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

/** A suite and the root of a monorepo declare no kind, and neither is ever published. */
export function manifestGap(
    role: Role,
    manifest: Readonly<Record<string, unknown>>,
): null | { fix: string; owes: string } {
    if (role === 'suite' || role === 'monorepo') {
        if (manifest.private === true) {
            return null;
        }

        return role === 'suite' ? SUITE_GAP : MONOREPO_GAP;
    }

    return publishedGap(role, manifest);
}

function gapFound(role: Role, unit: string, owes: string): string {
    const path = prefixed(unit, 'package.json');
    if (role === 'monorepo') {
        return `${path} lists \`workspaces\` and ${owes}`;
    }

    return `${prefixed(unit, SETTINGS_FILE)} declares ${role === 'suite' ? 'no kind, a suite' : NAMED[role]}, and ${path} ${owes}`;
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
    role: Role,
    known: ReadonlySet<string>,
): Finding[] {
    const manifest = manifestOf(context, unit);
    const gap = manifestGap(role, manifest);
    const path = prefixed(unit, 'package.json');
    const strays = unknownManifestKeys(manifest, known);

    return [
        ...(gap === null
            ? []
            : [
                  finding('config/kind-matches-manifest', path, {
                      fix: gap.fix,
                      found: gapFound(role, unit, gap.owes),
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
