import { posix } from 'node:path';

import { readText } from './project-files.js';

const MODULE = /\.(?:[cm]?[jt]sx?)$/u;

const GROUND = /(?:^|[/])(?:expected|fixtures|node_modules)[/]/u;

const SPECIFIER =
    /(?:\bfrom\s*|\bimport\s*\(\s*|^\s*import\s+)(?<quote>['"])(?<specifier>\.{1,2}\/[^'"]+)\k<quote>/gmu;

const SOURCE_OF = [
    ['.js', ['.ts', '.tsx', '.d.ts']],
    ['.mjs', ['.mts', '.d.mts']],
    ['.cjs', ['.cts', '.d.cts']],
];

function candidatesOf(target) {
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

export function importersOf(unit, files) {
    const modules = new Set(files.filter((file) => MODULE.test(file) && !GROUND.test(file)));
    const importers = new Map();
    for (const file of modules) {
        for (const { groups } of (readText(unit, file) ?? '').matchAll(SPECIFIER)) {
            const target = posix.normalize(posix.join(posix.dirname(file), groups.specifier));
            const imported = candidatesOf(target).find((candidate) => modules.has(candidate));
            if (imported === undefined || imported === file) {
                continue;
            }
            if (!importers.has(imported)) {
                importers.set(imported, new Set());
            }
            importers.get(imported).add(file);
        }
    }

    return importers;
}
