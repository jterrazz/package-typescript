import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import { EVERY_NAME } from './importers.js';

const REEXPORT_EVERY = /export\s+\*\s+(?:as\s+[\w$]+\s+)?from\s+['"](?<from>[^'"]+)['"]/gu;
const REEXPORT_NAMED =
    /export\s+(?:type\s+)?\{(?<names>[^}]*)\}\s*from\s+['"](?<from>[^'"]+)['"]/gu;
const BUILT = './dist/';
const SOURCE = './src/';
const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'];

const surfaceByPackage = new Map();

function packageRootOf(file) {
    let directory = dirname(file);
    while (!existsSync(join(directory, 'package.json'))) {
        const parent = dirname(directory);
        if (parent === directory) {
            return null;
        }
        directory = parent;
    }

    return directory;
}

function targetsOf(entry) {
    if (typeof entry === 'string') {
        return [entry];
    }
    if (typeof entry !== 'object' || entry === null) {
        return [];
    }

    return Object.entries(entry)
        .filter(([key]) => !key.includes('*'))
        .flatMap(([, nested]) => targetsOf(nested));
}

function existingSource(path) {
    const stem = path.replace(/\.[cm]?[jt]sx?$/u, '');
    const candidates = [
        path,
        ...SOURCE_EXTENSIONS.map((extension) => `${stem}${extension}`),
        ...SOURCE_EXTENSIONS.map((extension) => join(path, `index${extension}`)),
    ];

    return candidates.find((candidate) => existsSync(candidate) && !candidate.endsWith('.d.ts'));
}

function entryFilesOf(root) {
    let manifest;
    try {
        manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    } catch {
        return [];
    }
    const targets = [...targetsOf(manifest.exports), ...targetsOf(manifest.main)];

    return targets
        .map((target) =>
            target.startsWith(BUILT) ? `${SOURCE}${target.slice(BUILT.length)}` : target,
        )
        .map((target) => existingSource(resolve(root, target)))
        .filter((file) => file !== undefined);
}

function exportedFrom(text, directory) {
    const edges = [];
    for (const { groups } of text.matchAll(REEXPORT_EVERY)) {
        edges.push({ from: groups.from, names: EVERY_NAME });
    }
    for (const { groups } of text.matchAll(REEXPORT_NAMED)) {
        const pairs = groups.names
            .split(',')
            .map((specifier) => specifier.replace(/^\s*type\s+/u, '').trim())
            .filter((specifier) => specifier !== '')
            .map((specifier) => {
                const [local, exported = local] = specifier.split(/\s+as\s+/u);
                return { exported: exported.trim(), local: local.trim() };
            });
        edges.push({ from: groups.from, names: pairs });
    }

    return edges
        .filter(({ from }) => from.startsWith('.'))
        .map(({ from, names }) => ({ file: existingSource(resolve(directory, from)), names }))
        .filter(({ file }) => file !== undefined);
}

function widen(surface, file, names) {
    const known = surface.get(file);
    if (known === EVERY_NAME) {
        return false;
    }
    if (names === EVERY_NAME) {
        surface.set(file, EVERY_NAME);
        return true;
    }
    const merged = new Set(known);
    const before = merged.size;
    for (const name of names) {
        merged.add(name);
    }
    surface.set(file, merged);

    return known === undefined || merged.size > before;
}

function carried(edge, names) {
    if (edge.names === EVERY_NAME) {
        return names;
    }

    return edge.names
        .filter(({ exported }) => names === EVERY_NAME || names.has(exported))
        .map(({ local }) => local);
}

function surfaceOf(root) {
    const surface = new Map();
    const pending = entryFilesOf(root);
    for (const file of pending) {
        surface.set(file, EVERY_NAME);
    }
    while (pending.length > 0) {
        const file = pending.pop();
        const names = surface.get(file);
        let text;
        try {
            text = readFileSync(file, 'utf8');
        } catch {
            continue;
        }
        for (const edge of exportedFrom(text, dirname(file))) {
            if (widen(surface, edge.file, carried(edge, names))) {
                pending.push(edge.file);
            }
        }
    }

    return surface;
}

export function publishedNamesOf(file) {
    const root = packageRootOf(file);
    if (root === null) {
        return null;
    }
    if (!surfaceByPackage.has(root)) {
        surfaceByPackage.set(root, surfaceOf(root));
    }

    return surfaceByPackage.get(root).get(resolve(file)) ?? null;
}
