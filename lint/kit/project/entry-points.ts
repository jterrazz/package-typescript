import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { isJsonObject, parsedObject } from './json.js';
import type { JsonObject } from './json.js';
import { withoutDotSlash } from './packed-files.js';

export type Published = { browser: boolean; stem: string; target: string; what: string };

const DIST = 'dist';

const BUILT = /\.(?:d\.[cm]?ts|[cm]?js)$/u;

const DECLARATION = /\.d\.[cm]?ts$/u;

const CODE = /\.[cm]?js$/u;

export function subpathStemOf(subpath: string, browser: boolean): string {
    const parts = subpath === '.' ? [] : withoutDotSlash(subpath).split('/');

    return ['index', ...parts, ...(browser ? ['browser'] : [])].join('.');
}

export const binStemOf = (command: string): string => `${command}.bin`;

function exportedOf(value: unknown, subpath: string, browser: boolean): Published[] {
    if (typeof value === 'string') {
        return [
            {
                browser,
                stem: subpathStemOf(subpath, browser),
                target: value,
                what: `\`${subpath}\``,
            },
        ];
    }
    if (Array.isArray(value)) {
        return value.flatMap((one) => exportedOf(one, subpath, browser));
    }
    if (!isJsonObject(value)) {
        return [];
    }

    return Object.entries(value).flatMap(([key, nested]) =>
        key.startsWith('.')
            ? exportedOf(nested, key, false)
            : exportedOf(nested, subpath, browser || key === 'browser'),
    );
}

function binsOf(bin: unknown, name: unknown): Published[] {
    const commands: [string, unknown][] =
        typeof bin === 'string'
            ? [[typeof name === 'string' ? name.replace(/^@[^/]+\//u, '') : '', bin]]
            : Object.entries(isJsonObject(bin) ? bin : {});

    return commands.flatMap(([command, target]) =>
        typeof target === 'string'
            ? [{ browser: false, stem: binStemOf(command), target, what: `the bin \`${command}\`` }]
            : [],
    );
}

function importedOf(imports: unknown): Published[] {
    return Object.entries(isJsonObject(imports) ? imports : {}).flatMap(([key, value]) => {
        if (!key.startsWith('#') || key.includes('*')) {
            return [];
        }
        const what = `the private import \`${key}\``;

        return exportedOf(value, `./${key.slice(1)}`, false).map(
            ({ browser, stem, target }): Published => ({ browser, stem, target, what }),
        );
    });
}

const declaredOf = (manifest: JsonObject): Published[] => [
    ...exportedOf(manifest.exports, '.', false),
    ...importedOf(manifest.imports),
    ...exportedOf(manifest.main, '.', false),
    ...binsOf(manifest.bin, manifest.name),
];

const isUnderBuild = (target: string, outDir: string): boolean =>
    withoutDotSlash(target).startsWith(`${outDir}/`);

export function publishedOf(manifest: JsonObject, outDir: string): Published[] {
    return declaredOf(manifest)
        .filter(
            ({ target }) =>
                isUnderBuild(target, outDir) && BUILT.test(target) && !target.includes('*'),
        )
        .toSorted(
            (left, right) =>
                Number(DECLARATION.test(left.target)) - Number(DECLARATION.test(right.target)),
        );
}

export const unbuiltCodeOf = (manifest: JsonObject, outDir: string): Published[] =>
    declaredOf(manifest).filter(
        ({ stem, target }) =>
            !isUnderBuild(target, outDir) &&
            !target.includes('*') &&
            (stem.endsWith('.bin') || CODE.test(target)),
    );

export const outputOf = (target: string, outDir: string): string =>
    withoutDotSlash(target)
        .slice(outDir.length + 1)
        .replace(BUILT, '');

export const defaultSourceOf = ({ stem }: Published): string => `src/${stem}.ts`;

/** Output name to source, for every published file whose entry is on disk; empty when the package publishes nothing it builds. */
export function entryPoints(root: string): Record<string, string> {
    const manifest = join(root, 'package.json');
    if (!existsSync(manifest)) {
        return {};
    }

    let published: Published[];
    try {
        published = publishedOf(parsedObject(readFileSync(manifest, 'utf8')), DIST);
    } catch {
        return {};
    }

    const entries = new Map<string, string>();
    for (const one of published) {
        const source = defaultSourceOf(one);
        const output = outputOf(one.target, DIST);
        if (!entries.has(output) && existsSync(join(root, source))) {
            entries.set(output, source);
        }
    }

    return Object.fromEntries(
        [...entries].toSorted(([left], [right]) => left.localeCompare(right)),
    );
}

export const DEFAULT_SOURCE = 'src/index.ts';

export const DEFAULT_ENTRY: Readonly<Record<string, string>> = Object.freeze({
    index: DEFAULT_SOURCE,
});

export function buildEntriesOf(root: string): Record<string, string> {
    const entries = entryPoints(root);

    return Object.keys(entries).length > 0 ? entries : { ...DEFAULT_ENTRY };
}
