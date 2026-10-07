import { KNIP_PRESET } from '../../presets/knip/config.js';
import { listOf, mergedKnipConfig } from './config.js';
import type { KnipConfig } from './config.js';
import type { KnipProject, KnipUnit } from './settings.js';

/** A member's own knip workspace: the preset's entries, its build's and its settings', with its ignores read from its folder. */
function memberWorkspace({ entries, settings }: KnipUnit): KnipConfig {
    return {
        entry: [...new Set([...listOf(KNIP_PRESET.entry), ...entries, ...settings.entry])],
        ignore: settings.ignore,
        ignoreBinaries: settings.ignoreBinaries,
        ignoreDependencies: settings.ignoreDependencies,
    };
}

// outside: knip reads a flat config's `entry` as the root workspace's alone, and once `workspaces` is written the root's moves under `.` too.
function withMembers(merged: KnipConfig, members: Readonly<Record<string, KnipUnit>>): KnipConfig {
    const named = Object.entries(members);
    if (named.length === 0) {
        return merged;
    }
    const { entry, ...rest } = merged;

    return {
        ...rest,
        workspaces: Object.fromEntries([
            ['.', { entry }],
            ...named.map(([member, unit]) => [member, memberWorkspace(unit)]),
        ]),
    };
}

/** The config knip is handed: the root's, and at a workspace root each member's own under `workspaces`. */
export const knipConfigOf = (project: KnipProject): KnipConfig =>
    withMembers(mergedKnipConfig(project), project.members);
