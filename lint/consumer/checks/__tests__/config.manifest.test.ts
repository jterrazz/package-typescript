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
            null,
            new Set(KNOWN),
        );

        // Then - the three findings, each at the manifest, in this order
        expect(found).toStrictEqual([
            {
                column: 1,
                line: 1,
                message:
                    'found: jterrazz.config.ts declares no kind, a suite, and package.json is not `private`, so npm would publish the suite · why: A library publishes its exports, a published cli names its bin, and an application — an api, a website, a mobile app — is private, never published, as is a workspace\'s own suite. · fix: set `"private": true`: a suite is never published · read: docs/reference/quality-checks.md#the-config-one-file-pass',
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
                    "found: package.json holds `depedencies`, which npm and the tools of the family read nowhere · why: A manifest holds the top-level keys npm and the family's tools read: a key beyond them reads nothing, and a typo of one fails without a word. · fix: fix the key if it is a typo of one npm reads, move a tool's settings to `jterrazz.config.ts`, or delete it · read: docs/reference/quality-checks.md#the-config-one-file-pass",
                path: 'package.json',
                rule: 'config/manifest-keys-known',
            },
        ]);
    });
});
