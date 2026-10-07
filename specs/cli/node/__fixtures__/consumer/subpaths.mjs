import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

const installed = join('node_modules', '@jterrazz', 'typescript');
const { exports } = JSON.parse(readFileSync(join(installed, 'package.json'), 'utf8'));

function filesUnder(directory) {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory()
            ? filesUnder(join(directory, entry.name))
            : [relative(installed, join(directory, entry.name))],
    );
}

function targetsOf(node, condition = 'default') {
    if (typeof node === 'string') {
        return [{ condition, target: node }];
    }
    return Object.entries(node).flatMap(([key, child]) =>
        targetsOf(child, key === 'default' ? condition : key),
    );
}

function expanded(subpath, target) {
    if (!subpath.includes('*')) {
        return [{ specifier: join('@jterrazz/typescript', subpath), target }];
    }
    const [before, after] = target.replace(/^\.\//u, '').split('*');
    return filesUnder(join(installed, dirname(`${before}x`)))
        .filter((path) => path.startsWith(before) && path.endsWith(after))
        .map((path) => path.slice(before.length, path.length - after.length))
        .filter((stem) => !stem.includes('/'))
        .toSorted()
        .map((stem) => ({
            specifier: join('@jterrazz/typescript', subpath.replace('*', stem)),
            target: `./${before}${stem}${after}`,
        }));
}

function reached(path, seen = new Set()) {
    if (seen.has(path)) {
        return { modules: seen, packages: [] };
    }
    seen.add(path);
    const source = readFileSync(path, 'utf8');
    const specifiers = [...source.matchAll(/(?:from|import)\s*\(?\s*"([^"]+)"/gu)].map(
        ([, specifier]) => specifier,
    );
    const packages = specifiers.filter((specifier) => !specifier.startsWith('.'));
    for (const specifier of specifiers.filter((candidate) => candidate.startsWith('.'))) {
        packages.push(...reached(join(dirname(path), specifier), seen).packages);
    }
    return { modules: seen, packages: [...new Set(packages)].toSorted() };
}

async function load(specifier, condition, target) {
    const path = join(installed, target);
    if (!existsSync(path)) {
        return 'missing from the install';
    }
    if (condition === 'types') {
        return 'held';
    }
    if (condition === 'browser') {
        const { modules, packages } = reached(path);
        return packages.length === 0
            ? `reaches ${modules.size} modules, and imports no package`
            : `imports ${packages.join(', ')}`;
    }
    if (target.endsWith('.json')) {
        const { compilerOptions = {} } = (await import(specifier, { with: { type: 'json' } }))
            .default;
        return `parses, ${Object.keys(compilerOptions).length} compiler options`;
    }
    return `loads, ${Object.keys(await import(specifier)).length} names`;
}

for (const [subpath, node] of Object.entries(exports)) {
    for (const { condition, target } of targetsOf(node)) {
        for (const each of expanded(subpath, target)) {
            process.stdout.write(
                `${each.specifier} (${condition}) → ${each.target}: ${await load(each.specifier, condition, each.target)}\n`,
            );
        }
    }
}
