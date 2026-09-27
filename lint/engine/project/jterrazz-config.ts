// Node loads the file as oxlint loads `oxlint.config.ts`, by a dynamic `import()`. Without
// `"type": "module"` Node warns while reparsing it as ESM, so the gates run with that warning off.

import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { isJsonObject, objectOf } from './json.js';
import { resolveConfig } from './preset.js';
import type { Preset, Resolution } from './preset.js';

export const SETTINGS_FILE = 'jterrazz.config.ts';

export const DEPENDENCY_CRUISER_CONFIGS = [
    '.dependency-cruiser.cjs',
    '.dependency-cruiser.js',
    '.dependency-cruiser.mjs',
];

export type Config = Resolution;

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
    base: readonly Preset[],
): Config {
    const resolution = resolveConfig(read.declared, base);

    return read.problem === null ? resolution : { ...resolution, problem: read.problem };
}

export async function readConfig(unit: string, base: readonly Preset[]): Promise<Config> {
    const path = join(unit, SETTINGS_FILE);
    if (!existsSync(path)) {
        return resolveConfig(NOTHING_DECLARED, base);
    }
    try {
        return resolvedFrom(declaredOf(await import(pathToFileURL(path).href)), base);
    } catch (error) {
        return { ...resolveConfig(NOTHING_DECLARED, base), problem: failed(error) };
    }
}

const loadModule = createRequire(import.meta.url);

const loaded = new Map<string, Config>();

// For a reader that runs synchronously, as an oxlint rule does; Node loads a module once per process, and a file that appears later is still read.
export function readConfigSync(unit: string, base: readonly Preset[]): Config {
    const path = join(unit, SETTINGS_FILE);
    if (!existsSync(path)) {
        return resolveConfig(NOTHING_DECLARED, base);
    }
    const known = loaded.get(path);
    if (known !== undefined) {
        return known;
    }
    let config: Config;
    try {
        config = resolvedFrom(declaredOf(loadModule(path)), base);
    } catch (error) {
        config = { ...resolveConfig(NOTHING_DECLARED, base), problem: failed(error) };
    }
    loaded.set(path, config);

    return config;
}
