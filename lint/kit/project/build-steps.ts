import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';

import { objectOf, parsedObject } from './json.js';
import type { JsonObject } from './json.js';
import { declaredDependencies } from './manifest.js';
import type { ProjectIdentity } from './project-kind.js';
import { workspaceMembers } from './workspace-members.js';

export const DIST = 'dist';

export type BuildStep = {
    clean: boolean;
    dts: boolean;
    entry: Readonly<Record<string, string>>;
    deps?: { neverBundle: string[] };
    fixedExtension: false;
    format: ('cjs' | 'esm')[];
    hash: false;
    outDir: string;
    outputOptions: { banner?: string; chunkFileNames: string; exports?: 'named' };
    platform: 'browser' | 'node';
    sourcemap: true;
};

export const manifestAt = (root: string): JsonObject => {
    const path = join(root, 'package.json');

    // Stryker disable next-line StringLiteral: JSON.parse reads a Buffer as its UTF-8 text, so the encoding only names the type
    return existsSync(path) ? parsedObject(readFileSync(path, 'utf8')) : {};
};

export const stepOf = (
    entry: Readonly<Record<string, string>>,
    {
        banner,
        clean = false,
        dts = true,
        external = [],
        format = ['esm'],
        outDir = DIST,
        platform,
    }: Partial<BuildStep> & Pick<BuildStep, 'platform'> & { banner?: string; external?: string[] },
): BuildStep => ({
    clean,
    dts,
    entry,
    ...(external.length === 0 ? {} : { deps: { neverBundle: external } }),
    fixedExtension: false,
    format,
    hash: false,
    outDir,
    outputOptions: {
        ...(banner === undefined ? {} : { banner }),
        chunkFileNames: 'shared-[name].js',
        ...(format.includes('cjs') ? { exports: 'named' as const } : {}),
    },
    platform,
    sourcemap: true,
});

export type Shape = { dts: boolean; external: string[] };

const HASHBANG = '#!/usr/bin/env node';

const DEPENDENCY_FIELDS = [
    'dependencies',
    'devDependencies',
    'optionalDependencies',
    'peerDependencies',
];

// outside: a host program (an editor, a browser) ships its API as `@types/<name>` and exists only inside the process that loads the extension; the bundler finds no package to resolve, and the build is not told to look for one.
function hostModulesOf(manifest: JsonObject): string[] {
    const declared = DEPENDENCY_FIELDS.flatMap((field) => Object.keys(objectOf(manifest[field])));
    const held = new Set(declared);

    return declared
        .filter((name) => name.startsWith('@types/'))
        .map((name) => {
            const typed = name.slice('@types/'.length);

            return typed.includes('__') ? `@${typed.replace('__', '/')}` : typed;
        })
        .filter((name) => !held.has(name))
        .toSorted();
}

function dependsOnAny(workspace: string, members: readonly string[], name: string): boolean {
    return members.some((member) => declaredDependencies(join(workspace, member)).has(name));
}

// invariant: a member of a workspace is read by the members that depend on it, whether it is published or not; the walk stops at the first ancestor whose workspace holds the project, and a manifest with no name reads as "undefined", which no member declares.
function isReadBySibling(root: string, name: unknown): boolean {
    const absolute = resolve(root);
    let ancestor = dirname(absolute);
    while (ancestor !== dirname(ancestor)) {
        const members = workspaceMembers(ancestor);
        if (members.includes(relative(ancestor, absolute).split(sep).join('/'))) {
            return dependsOnAny(ancestor, members, String(name));
        }
        ancestor = dirname(ancestor);
    }

    return false;
}

// invariant: a library or a cli that is private is installed by its own repository, which reads no declaration of it unless a sibling member of its workspace depends on it: emitting them otherwise only fails on a module the host provides.
export function shapeOf(root: string, declaration: null | ProjectIdentity): Shape {
    const manifest = manifestAt(root);
    // Stryker disable next-line StringLiteral: no declaration is no kind of the list, whatever text stands in for it
    const kind = declaration?.kind ?? '';
    const unread =
        manifest.private === true &&
        ['cli', 'library'].includes(kind) &&
        !isReadBySibling(root, manifest.name);

    return { dts: !unread, external: hostModulesOf(manifest) };
}

const lacksHashbang = (root: string, source: string): boolean => {
    try {
        return !readFileSync(join(root, source), 'utf8').startsWith('#!');
    } catch {
        return false;
    }
};

// invariant: the command a `bin` names is run by its path, so the file opens on the interpreter line the source may omit; a source that holds one keeps it.
export function nodeEntries(
    entries: Readonly<Record<string, string>>,
    root: string,
    shape: Shape,
    platform: BuildStep['platform'],
): BuildStep[] {
    const withBin = Object.entries(entries).filter(
        ([, source]) => source.endsWith('.bin.ts') && lacksHashbang(root, source),
    );
    const bins = Object.fromEntries(withBin);
    const others = Object.fromEntries(
        Object.entries(entries).filter(([output]) => !(output in bins)),
    );

    return [
        ...(Object.keys(others).length === 0 ? [] : [stepOf(others, { ...shape, platform })]),
        ...(withBin.length === 0 ? [] : [stepOf(bins, { ...shape, banner: HASHBANG, platform })]),
    ];
}
