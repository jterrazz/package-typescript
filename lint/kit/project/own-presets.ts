import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import process from 'node:process';

import { refusal } from '../catalogue/lesson.js';
import { isJsonObject } from './json.js';
import { isPreset } from './preset.js';
import type { Preset } from './preset.js';

/** Each module of the repository's own build, mapped to the name of the preset it exports. */
export type OwnPresets = Readonly<Record<string, string>>;

// invariant: `typescript build` reads the settings file before the build it makes exists; every other reader needs the build.
const isBuilding = (): boolean => process.argv[2] === 'build';

function presetIn(module: unknown, name: string, path: string): Preset {
    const make = isJsonObject(module) ? module[name] : undefined;
    // Stryker disable next-line ArrayDeclaration: a preset is made with no argument, and one it ignores changes nothing
    const preset: unknown = typeof make === 'function' ? Reflect.apply(make, undefined, []) : null;
    if (!isPreset(preset)) {
        throw new TypeError(
            refusal({
                fix: `export \`${name}\` from the module ${path} is built from, or name the export it holds`,
                found: `${path} exports no preset \`${name}\``,
                read: 'docs/reference/configuration.md#a-repository-held-to-its-own-presets',
                why: 'the settings file lists the preset by that name, and a missing one judges none of what it holds',
            }),
        );
    }

    return preset;
}

/** The presets a repository holds itself to from its own build: none while `typescript build` makes it, refused when it is missing. Loaded synchronously, so the settings file holds no top-level await and its synchronous readers, the oxlint rules, read it whole. */
export function ownPresets(settingsUrl: string, modules: OwnPresets): Preset[] {
    const missing = Object.keys(modules).filter((path) => !existsSync(new URL(path, settingsUrl)));
    if (missing.length > 0 && isBuilding()) {
        return [];
    }
    if (missing.length > 0) {
        throw new Error(
            refusal({
                fix: 'run `npm run build`, then run the command again',
                found: `this repository's presets are not built: ${missing.join(', ')} missing`,
                read: 'docs/reference/configuration.md#a-repository-held-to-its-own-presets',
                why: 'they are this repository’s own build, and a run without them judges none of what they hold, so it would pass on nothing',
            }),
        );
    }

    const load = createRequire(settingsUrl);

    return Object.entries(modules).map(([path, name]) => presetIn(load(path), name, path));
}
