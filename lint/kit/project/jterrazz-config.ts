// outside: Node loads the file as oxlint loads `oxlint.config.ts`, by a dynamic `import()`. Without
// `"type": "module"` Node warns while reparsing it as ESM, so the reader loads it with that warning off.

import { existsSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import { isJsonObject, objectOf } from './json.js';
import { resolveConfig } from './preset.js';
import type { BasePresets, Resolution } from './preset.js';

export const SETTINGS_FILE = 'jterrazz.config.ts';

export const DEPENDENCY_CRUISER_CONFIGS = [
    '.dependency-cruiser.cjs',
    '.dependency-cruiser.js',
    '.dependency-cruiser.mjs',
];

const NOTHING_DECLARED = {};

function declaredOf(loaded: unknown): { declared: object; problem: null | string } {
    const settings = objectOf(loaded).default;

    return isJsonObject(settings)
        ? { declared: settings, problem: null }
        : {
              declared: NOTHING_DECLARED,
              problem:
                  'exports no settings object as its default — write `export default defineConfig({ … })`',
          };
}

const failed = (error: unknown): string =>
    `does not load — ${String(error instanceof Error ? error.message : error).split('\n')[0] ?? ''}`;

function resolvedFrom(
    read: { declared: object; problem: null | string },
    base: BasePresets,
): Resolution {
    const resolution = resolveConfig(read.declared, base);

    return read.problem === null ? resolution : { ...resolution, problem: read.problem };
}

const TYPELESS = 'MODULE_TYPELESS_PACKAGE_JSON';

const isTypeless = (options: unknown): boolean =>
    options === TYPELESS ||
    (typeof options === 'object' &&
        options !== null &&
        'code' in options &&
        options.code === TYPELESS);

async function importedQuietly(path: string): Promise<unknown> {
    const emit = process.emitWarning.bind(process);
    const descriptor = Object.getOwnPropertyDescriptor(process, 'emitWarning');
    process.emitWarning = (warning: Error | string, ...rest: unknown[]): void => {
        if (!rest.some((option) => isTypeless(option))) {
            Reflect.apply(emit, process, [warning, ...rest]);
        }
    };
    try {
        // Stryker disable next-line StringLiteral: an empty import specifier fails the bundle every spec runs, so the mutant can reach no test
        return await import(`${pathToFileURL(path).href}?mtime=${String(statSync(path).mtimeMs)}`);
    } finally {
        if (descriptor === undefined) {
            Reflect.deleteProperty(process, 'emitWarning');
        } else {
            Object.defineProperty(process, 'emitWarning', descriptor);
        }
    }
}

export async function readConfig(unit: string, base: BasePresets): Promise<Resolution> {
    const path = join(unit, SETTINGS_FILE);
    if (!existsSync(path)) {
        return resolveConfig(NOTHING_DECLARED, base);
    }
    try {
        return resolvedFrom(declaredOf(await importedQuietly(path)), base);
    } catch (error) {
        return { ...resolveConfig(NOTHING_DECLARED, base), problem: failed(error) };
    }
}

const loadModule = createRequire(import.meta.url);

const loaded = new Map<string, Resolution>();

// outside: for a reader that runs synchronously, as an oxlint rule does; Node loads a module once per process, and a file that appears later is still read.
export function readConfigSync(unit: string, base: BasePresets): Resolution {
    const path = join(unit, SETTINGS_FILE);
    if (!existsSync(path)) {
        return resolveConfig(NOTHING_DECLARED, base);
    }
    const known = loaded.get(path);
    if (known !== undefined) {
        return known;
    }
    let config: Resolution;
    try {
        config = resolvedFrom(declaredOf(loadModule(path)), base);
    } catch (error) {
        config = { ...resolveConfig(NOTHING_DECLARED, base), problem: failed(error) };
    }
    loaded.set(path, config);

    return config;
}
