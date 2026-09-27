import { posix } from 'node:path';

import { GROUND_FOLDERS } from './ground.js';
import { readText } from './project-files.js';

const MODULE = /\.(?:[cm]?[jt]sx?)$/u;

const UNREAD = new RegExp(`(?:^|/)(?:${[...GROUND_FOLDERS, 'node_modules'].join('|')})/`, 'u');

export const EVERY_NAME = '*';

const STATIC =
    /(?:^|[;\n])\s*(?:import|export)\s+(?:type\s+)?(?<clause>[^;'"]*?)\s*from\s*(?<quote>['"])(?<specifier>\.{1,2}\/[^'"]+)\k<quote>/gu;

const DYNAMIC =
    /\b(?:import|require)\s*\(\s*(?<quote>['"])(?<specifier>\.{1,2}\/[^'"]+)\k<quote>/gu;

const SOURCE_OF: readonly (readonly [string, readonly string[]])[] = [
    ['.js', ['.ts', '.tsx', '.d.ts']],
    ['.mjs', ['.mts', '.d.mts']],
    ['.cjs', ['.cts', '.d.cts']],
];

function candidatesOf(target: string): string[] {
    const swapped = SOURCE_OF.filter(([built]) => target.endsWith(built)).flatMap(
        ([built, sources]) => sources.map((source) => `${target.slice(0, -built.length)}${source}`),
    );

    return [
        target,
        ...swapped,
        `${target}.ts`,
        `${target}.js`,
        `${target}/index.ts`,
        `${target}/index.js`,
    ];
}

function namesOf(clause: string): string[] {
    if (clause.includes('*')) {
        return [EVERY_NAME];
    }
    const listed = /\{(?<list>[^}]*)\}/u.exec(clause)?.groups?.list ?? '';

    return listed
        .split(',')
        .map(
            (entry) =>
                entry
                    .trim()
                    .replace(/^type\s+/u, '')
                    .split(/\s+as\s+/u)[0] ?? '',
        )
        .filter((name) => name !== '');
}

function importsOf(text: string): { names: string[]; specifier: string }[] {
    return [
        ...[...text.matchAll(STATIC)].map(({ groups }) => ({
            names: namesOf(groups?.clause ?? ''),
            specifier: groups?.specifier ?? '',
        })),
        ...[...text.matchAll(DYNAMIC)].map(({ groups }) => ({
            names: [EVERY_NAME],
            specifier: groups?.specifier ?? '',
        })),
    ];
}

export type Importers = Map<string, Map<string, Set<string>>>;

export function importersOf(unit: string, files: readonly string[]): Importers {
    const modules = new Set(files.filter((file) => MODULE.test(file) && !UNREAD.test(file)));
    const importers: Importers = new Map();
    for (const file of modules) {
        for (const { names, specifier } of importsOf(readText(unit, file) ?? '')) {
            const target = posix.normalize(posix.join(posix.dirname(file), specifier));
            const imported = candidatesOf(target).find((candidate) => modules.has(candidate));
            if (imported === undefined || imported === file) {
                continue;
            }
            const readers = importers.get(imported) ?? new Map<string, Set<string>>();
            importers.set(imported, readers);
            readers.set(file, new Set([...(readers.get(file) ?? []), ...names]));
        }
    }

    return importers;
}
