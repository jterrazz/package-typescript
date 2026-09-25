// Node loads the file as oxlint loads `oxlint.config.ts`, by a dynamic `import()`. Without
// `"type": "module"` Node warns while reparsing it as ESM, so the gates run with that warning off.

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const SETTINGS_FILE = 'jterrazz.config.ts';

const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

export async function readSection(unit, name) {
    const path = join(unit, SETTINGS_FILE);
    if (!existsSync(path)) {
        return { problem: null, section: {} };
    }

    let loaded;
    try {
        loaded = await import(pathToFileURL(path).href);
    } catch (error) {
        const reason = String(error instanceof Error ? error.message : error).split('\n')[0];

        return { problem: `does not load — ${reason}`, section: {} };
    }

    const settings = loaded.default;
    if (!isRecord(settings)) {
        return {
            problem:
                'exports no settings object as its default — write `export default defineConfig({ … })`',
            section: {},
        };
    }
    if (settings[name] === undefined) {
        return { problem: null, section: {} };
    }
    if (!isRecord(settings[name])) {
        return { problem: `holds a \`${name}\` section that is not an object`, section: {} };
    }

    return { problem: null, section: settings[name] };
}
