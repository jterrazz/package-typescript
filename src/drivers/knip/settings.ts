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
