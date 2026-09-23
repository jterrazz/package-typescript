/**
 * The family's settings file, read: `jterrazz.config.ts` at a unit's root —
 * the repository, or a workspace member — whose default export holds one
 * section per package of the family (`@jterrazz/typescript/config`).
 *
 * Node loads the file itself, types stripped, exactly as oxlint loads
 * `oxlint.config.ts`: a dynamic `import()` of its URL. A project with no
 * `"type": "module"` makes Node print a warning while it reparses the file as
 * ESM, which is why the gates that read it run with that warning disabled.
 *
 * A missing file is no settings at all. A file that does not load, or whose
 * default export is not a settings object, is a PROBLEM the reader reports:
 * silence there would read as "nothing declared" while the repository
 * believes it declared something.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

/** The file, at the root of the unit it configures. */
export const SETTINGS_FILE = 'jterrazz.config.ts';

/** A plain object — never an array, never null. */
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * One package's section of a unit's settings: `{ section, problem }`, where
 * `section` is `{}` whenever nothing usable is declared and `problem` names
 * why the file could not be read, or is null.
 */
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
