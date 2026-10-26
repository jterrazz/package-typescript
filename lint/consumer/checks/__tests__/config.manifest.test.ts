import { describe, expect, test } from 'vitest';

import type { Context } from '../../../kit/checker/pass.js';
import { manifestFindings, unknownManifestKeys } from '../config.manifest.js';

// outside: written out again here, from npm's own documentation and the tools of the family: the table under test cannot be its own oracle.
const KNOWN = [
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
];

function noValue(flag: string): string | undefined;
function noValue(flag: string, fallback: string): string;
function noValue(_flag: string, fallback?: string): string | undefined {
    return fallback;
}

function contextOver(manifest: object): Context {
    return {
        config: async () => await Promise.reject(new Error('no settings are read here')),
        exists: () => false,
        files: () => [],
        fix: false,
        has: () => false,
        list: () => null,
        positionals: [],
        read: () => JSON.stringify(manifest),
        root: '/repo',
        value: noValue,
        verbatim: async () => await Promise.resolve([]),
    };
}

const opening = (found: readonly { message: string }[]): string[] =>
    found.map(({ message }) => message.split(' · ')[0] ?? '');

const fixOf = (found: readonly { message: string }[]): string[] =>
    found.map(({ message }) => message.split(' · fix: ')[1]?.split(' · ')[0] ?? '');

describe('config.manifest', () => {
    test('unknownManifestKeys — every field npm and the tools of the family read is known, a comment key is none, and any other key is named', () => {
        // Given - a manifest writing every known field, one writing comments and typos
        const known = Object.fromEntries(KNOWN.map((key) => [key, 1]));
        const odd = { $schema: 1, _note: 1, depedencies: 1, name: 'x', trailing_: 1, scriptz: 1 };

        // Then - none of the first is named, and the typos of the second are, the comments not
        expect([
            unknownManifestKeys(known, new Set(KNOWN)),
            unknownManifestKeys(odd, new Set(KNOWN)),
        ]).toStrictEqual([[], ['depedencies', 'trailing_', 'scriptz']]);
    });

    test('unknownManifestKeys — a key the standard of a host adds is known, and a typo of it is named', () => {
        // Given - the keys a VS Code extension adds to the known ones
        const known = new Set([...KNOWN, 'contributes', 'publisher']);

        // Then - the added keys pass and their typo is named
        expect(
            unknownManifestKeys(
                { contributes: {}, name: 'x', publisher: 'p', publishers: 'p' },
                known,
            ),
        ).toStrictEqual(['publishers']);
    });

    test('manifestFindings — a suite that is public, a manifest that is no module and a key nothing reads are each a finding with its lesson', () => {
        // Given - a workspace suite's manifest that is public, CommonJS and holds a typo
        const found = manifestFindings(
            contextOver({ depedencies: {}, name: 'suite', private: false }),
            '.',
            'suite',
            new Set(KNOWN),
        );

        // Then - the three findings, each at the manifest, in this order
        expect(found).toStrictEqual([
            {
                column: 1,
                line: 1,
                message:
                    'found: studio.config.ts declares no kind, a suite, and package.json is not `private`, so npm would publish the suite · why: A library publishes its exports, a published cli names its bin, and an application (an api, a website, a mobile app) is private, never published, as are a monorepo\'s own suite and its root, a container that declares no kind. · fix: set `"private": true`: a suite is never published · read: docs/reference/quality-checks.md#the-config-one-file-pass',
                path: 'package.json',
                rule: 'config/kind-matches-manifest',
            },
            {
                column: 1,
                line: 1,
                message:
                    'found: package.json does not set `"type": "module"`, and the vitest config the toolchain derives and the names its build gives the files are ESM\'s · why: A project is an ES module, its manifest setting "type": "module": the vitest config the toolchain derives and the names its build gives the files are ESM\'s, and a package without it fails in both without saying why. · fix: set `"type": "module"` · read: docs/reference/quality-checks.md#the-config-one-file-pass',
                path: 'package.json',
                rule: 'config/manifest-is-a-module',
            },
            {
                column: 1,
                line: 1,
                message:
                    "found: package.json holds `depedencies`, which npm and the tools of the family read nowhere · why: A manifest holds the top-level keys npm and the family's tools read: a key beyond them reads nothing, and a typo of one fails without a word. · fix: fix the key if it is a typo of one npm reads, move a tool's settings to `studio.config.ts`, or delete it; a key that carries information for a reader (a credit, a fork's origin) moves to the README · read: docs/reference/quality-checks.md#the-config-one-file-pass",
                path: 'package.json',
                rule: 'config/manifest-keys-known',
            },
        ]);
    });

    test('manifestFindings — a cli whose bin is an empty object and two keys nothing reads are each named whole', () => {
        // Given - a public cli naming `bin: {}`, and a manifest with two typos
        const known = new Set(KNOWN);
        const cli = manifestFindings(
            contextOver({ bin: {}, name: 'tool', type: 'module' }),
            '.',
            'cli',
            known,
        );
        const typos = manifestFindings(
            contextOver({ depedencies: {}, name: 'x', scriptz: {}, type: 'module' }),
            '.',
            'library',
            known,
        );

        // Then - the empty bin is no bin, and both typos are listed in order
        expect(cli.map(({ message }) => message.split(' · ')[0])).toStrictEqual([
            'found: studio.config.ts declares a cli, and package.json names no `bin`',
        ]);
        expect(
            typos
                .filter(({ rule }) => rule === 'config/manifest-keys-known')
                .map(({ message }) => message.split(' · ')[0]),
        ).toStrictEqual([
            'found: package.json holds `depedencies`, `scriptz`, which npm and the tools of the family read nowhere',
        ]);
    });

    test('manifestFindings — the root of a monorepo that npm would publish, and a project that lists `workspaces`, are each refused with what to do; a private root is not', () => {
        // Given - a public monorepo root, a private one, and an api whose manifest lists members
        const known = new Set(KNOWN);
        const published = manifestFindings(
            contextOver({ name: 'estate', type: 'module', workspaces: ['apps/*'] }),
            '.',
            'monorepo',
            known,
        );
        const container = manifestFindings(
            contextOver({ name: 'estate', private: true, type: 'module', workspaces: ['apps/*'] }),
            '.',
            'monorepo',
            known,
        );
        const project = manifestFindings(
            contextOver({ name: 'api', private: true, type: 'module', workspaces: ['apps/*'] }),
            'apps/api',
            'api',
            known,
        );

        // Then - the public root and the api are refused, the private root passes
        expect(opening(published)).toStrictEqual([
            'found: package.json lists `workspaces` and is not `private`, so npm would publish the root of a monorepo, which is a container, never a project',
        ]);
        expect(fixOf(published)).toStrictEqual([
            'set `"private": true`, and publish what the repository ships from a member of its own under `packages/`',
        ]);
        expect(container).toStrictEqual([]);
        expect(opening(project)).toStrictEqual([
            'found: apps/api/studio.config.ts declares an api, and apps/api/package.json declares `workspaces`, so it is the root of a monorepo, a container that declares no kind: its own sources would be read as a member of itself',
        ]);
        expect(fixOf(project)).toStrictEqual([
            'drop `kind` and `platform` from its studio.config.ts and move its sources into a member under `apps/` or `packages/` that declares its own, or drop `workspaces` when the repository is one project',
        ]);
    });
});
