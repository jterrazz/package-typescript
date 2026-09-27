import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import { EVERY_NAME } from './importers.js';

const REEXPORT_EVERY = /export\s+\*\s+(?:as\s+[\w$]+\s+)?from\s+['"](?<from>[^'"]+)['"]/gu;
const REEXPORT_NAMED =
    /export\s+(?:type\s+)?\{(?<names>[^}]*)\}\s*from\s+['"](?<from>[^'"]+)['"]/gu;
const BUILT = './dist/';
const SOURCE = './src/';
const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'];

type Names = ReadonlySet<string> | typeof EVERY_NAME;

type Surface = Map<string, Names>;

type Edge = { file: string; names: typeof EVERY_NAME | { exported: string; local: string }[] };

const surfaceByPackage = new Map<string, Surface>();

function packageRootOf(file: string): null | string {
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

function targetsOf(entry: unknown): string[] {
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

function existingSource(path: string): string | undefined {
    const stem = path.replace(/\.[cm]?[jt]sx?$/u, '');
    const candidates = [
        path,
        ...SOURCE_EXTENSIONS.map((extension) => `${stem}${extension}`),
        ...SOURCE_EXTENSIONS.map((extension) => join(path, `index${extension}`)),
    ];

    return candidates.find((candidate) => existsSync(candidate) && !candidate.endsWith('.d.ts'));
}

function entryFilesOf(root: string): string[] {
    let manifest: { exports?: unknown; main?: unknown };
    try {
        manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as typeof manifest;
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

function exportedFrom(text: string, directory: string): Edge[] {
    const edges: { from: string; names: Edge['names'] }[] = [];
    for (const { groups } of text.matchAll(REEXPORT_EVERY)) {
        edges.push({ from: groups?.from ?? '', names: EVERY_NAME });
    }
    for (const { groups } of text.matchAll(REEXPORT_NAMED)) {
        const pairs = (groups?.names ?? '')
            .split(',')
            .map((specifier) => specifier.replace(/^\s*type\s+/u, '').trim())
            .filter((specifier) => specifier !== '')
            .map((specifier) => {
                const [local = '', exported = local] = specifier.split(/\s+as\s+/u);
                return { exported: exported.trim(), local: local.trim() };
            });
        edges.push({ from: groups?.from ?? '', names: pairs });
    }

    return edges
        .filter(({ from }) => from.startsWith('.'))
        .flatMap(({ from, names }) => {
            const file = existingSource(resolve(directory, from));
            return file === undefined ? [] : [{ file, names }];
        });
}

function widen(
    surface: Surface,
    file: string,
    names: Iterable<string> | typeof EVERY_NAME,
): boolean {
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

function carried(edge: Edge, names: Names | undefined): Iterable<string> | typeof EVERY_NAME {
    if (edge.names === EVERY_NAME) {
        return names ?? [];
    }

    return edge.names
        .filter(({ exported }) => names === EVERY_NAME || names?.has(exported) === true)
        .map(({ local }) => local);
}

function surfaceOf(root: string): Surface {
    const surface: Surface = new Map();
    const pending = entryFilesOf(root);
    for (const file of pending) {
        surface.set(file, EVERY_NAME);
    }
    while (pending.length > 0) {
        const file = pending.pop() ?? '';
        const names = surface.get(file);
        let text: string;
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

export function publishedNamesOf(file: string): Names | null {
    const root = packageRootOf(file);
    if (root === null) {
        return null;
    }
    const surface = surfaceByPackage.get(root) ?? surfaceOf(root);
    surfaceByPackage.set(root, surface);

    return surface.get(resolve(file)) ?? null;
}
