import { existsSync, mkdirSync, readFileSync, realpathSync, symlinkSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

import { isRecord, parsedJson } from '../parsed-json.ts';

export const CHECKOUT = resolve(import.meta.dirname, '../../..');

const CHECKOUT_MODULES = join(CHECKOUT, 'node_modules');

type Manifest = {
    bin?: Record<string, string> | string;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    name?: string;
    optionalDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
    peerDependenciesMeta?: Record<string, { optional?: boolean }>;
    workspaces?: string[];
};

export function readManifest(directory: string): Manifest {
    return parsedJson(
        readFileSync(join(directory, 'package.json'), 'utf8'),
        (value): value is Manifest => isRecord(value),
    );
}

export function runtimeDependencies(manifest: Manifest): string[] {
    return [
        ...Object.keys(manifest.dependencies ?? {}),
        ...Object.keys(manifest.optionalDependencies ?? {}),
        ...Object.keys(manifest.peerDependencies ?? {}).filter(
            (name) => manifest.peerDependenciesMeta?.[name]?.optional !== true,
        ),
    ];
}

function locate(name: string, from: string): string | undefined {
    for (let directory = from; ; directory = dirname(directory)) {
        const candidate = join(directory, 'node_modules', name);
        if (existsSync(candidate)) {
            return realpathSync(candidate);
        }
        if (directory === CHECKOUT || directory === dirname(directory)) {
            return undefined;
        }
    }
}

export function hoistedClosure(names: string[]): string[] {
    const hoisted = new Set<string>();
    const visited = new Set<string>();
    const walk = (name: string, from: string): void => {
        const found = locate(name, from);
        if (found === undefined || visited.has(found)) {
            return;
        }
        visited.add(found);
        const topLevel = join(CHECKOUT_MODULES, name);
        if (existsSync(topLevel) && realpathSync(topLevel) === found) {
            hoisted.add(name);
        }
        for (const dependency of runtimeDependencies(readManifest(found))) {
            walk(dependency, found);
        }
    };
    for (const name of names) {
        walk(name, CHECKOUT);
    }
    return [...hoisted].toSorted();
}

export function linkFromCheckout(name: string, modules: string): void {
    const target = join(modules, name);
    if (!existsSync(target)) {
        mkdirSync(dirname(target), { recursive: true });
        symlinkSync(join(CHECKOUT_MODULES, name), target);
    }
}

export function linkBins(packageDirectory: string, modules: string): void {
    const { bin, name = '' } = readManifest(packageDirectory);
    const bins = typeof bin === 'string' ? { [name.split('/').at(-1) ?? name]: bin } : (bin ?? {});
    mkdirSync(join(modules, '.bin'), { recursive: true });
    for (const [command, target] of Object.entries(bins)) {
        const link = join(modules, '.bin', command);
        if (!existsSync(link)) {
            symlinkSync(relative(join(modules, '.bin'), join(packageDirectory, target)), link);
        }
    }
}
