import { join } from 'node:path';

import { isFileOnDisk } from '../../../lint/kit/project/fs-cache.js';
import { objectOf } from '../../../lint/kit/project/json.js';

export type KnipSettings = {
    entry: readonly string[];
    ignore: readonly string[];
    ignoreBinaries: readonly string[];
    ignoreDependencies: readonly string[];
};

export type KnipUnit = { entries: readonly string[]; settings: KnipSettings };

/** The root's unit, and each workspace member's by its folder. */
export type KnipProject = KnipUnit & { members: Readonly<Record<string, KnipUnit>> };

export function knipSettingsOf(section: unknown): KnipSettings {
    const written = objectOf(objectOf(section).knip);
    const named = (key: string): string[] => Object.keys(objectOf(written[key]));

    return {
        entry: named('entry'),
        ignore: named('ignore'),
        ignoreBinaries: named('ignoreBinaries'),
        ignoreDependencies: named('ignoreDependencies'),
    };
}

/** The packages the presets load by name for a unit, ignored as unused beside the ones its settings name. */
export function withLoadedPackages(
    settings: KnipSettings,
    packages: readonly string[],
): KnipSettings {
    return packages.length === 0
        ? settings
        : {
              ...settings,
              ignoreDependencies: [...new Set([...settings.ignoreDependencies, ...packages])],
          };
}

/** A unit holding a `go.mod` shells out to `go`, which no manifest lists: knip reads the binary as unlisted unless told. */
export function withGoToolchain(unit: string, settings: KnipSettings): KnipSettings {
    return isFileOnDisk(join(unit, 'go.mod'))
        ? { ...settings, ignoreBinaries: [...new Set([...settings.ignoreBinaries, 'go'])] }
        : settings;
}
