// Node loads the file as oxlint loads `oxlint.config.ts`, by a dynamic `import()`. Without
// `"type": "module"` Node warns while reparsing it as ESM, so the gates run with that warning off.

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { objectOf } from './json.js';

export const SETTINGS_FILE = 'jterrazz.config.ts';

export const DEPENDENCY_CRUISER_CONFIGS = [
    '.dependency-cruiser.cjs',
    '.dependency-cruiser.js',
    '.dependency-cruiser.mjs',
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === 'object' && !Array.isArray(value);

export type Section = { problem: null | string; section: Record<string, unknown> };

export async function readSection(unit: string, name: string): Promise<Section> {
    const path = join(unit, SETTINGS_FILE);
    if (!existsSync(path)) {
        return { problem: null, section: {} };
    }

    let loaded: unknown;
    try {
        loaded = await import(pathToFileURL(path).href);
    } catch (error) {
        const reason = String(error instanceof Error ? error.message : error).split('\n')[0];

        return { problem: `does not load — ${reason}`, section: {} };
    }

    const settings = objectOf(loaded).default;
    if (!isRecord(settings)) {
        return {
            problem:
                'exports no settings object as its default — write `export default defineConfig({ … })`',
            section: {},
        };
    }
    const section = settings[name];
    if (section === undefined) {
        return { problem: null, section: {} };
    }
    if (!isRecord(section)) {
        return { problem: `holds a \`${name}\` section that is not an object`, section: {} };
    }

    return { problem: null, section };
}

export type Declared = { declared: unknown[]; problem: null | string };

const isPreset = (value: unknown): value is Record<string, unknown> =>
    isRecord(value) && typeof value.name === 'string' && value.name !== '';

export function declaredUnder(section: Readonly<Record<string, unknown>>, key: string): Declared {
    const { presets = [] } = section;
    if (!Array.isArray(presets) || !presets.every((preset) => isPreset(preset))) {
        return {
            declared: [],
            problem:
                'holds a `presets` that is not a list of presets, each an object carrying the `name` of the package that ships it',
        };
    }

    return {
        declared: [section, ...presets]
            .map((holder) => holder[key])
            .filter((value) => value !== undefined),
        problem: null,
    };
}
