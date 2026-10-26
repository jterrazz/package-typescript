import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import type { OxlintConfig, OxlintOverride } from 'oxlint';

import { basePresetsOf } from './consumer/catalogue/preset.js';
import { PROFILES } from './consumer/rulebook/profiles.js';
import { unsafeFixers } from './kit/catalogue/decisions.js';
import { refusal } from './kit/catalogue/lesson.js';
import { merge, profile } from './kit/compiler/compile.js';
import { verbatimTreesOf } from './kit/project/byte-for-byte.js';
import { folderPlatformsOf } from './kit/project/folder-platforms.js';
import { objectOf } from './kit/project/json.js';
import { presetLesson } from './kit/project/preset.js';
import type { Preset, Resolution } from './kit/project/preset.js';
import type { Platform } from './kit/project/project-kind.js';
import { projectOxlintOf } from './kit/project/project-oxlint.js';
import { readConfig, SETTINGS_FILE } from './kit/project/studio-config.js';
import { isMonorepoRoot, workspaceMembers } from './kit/project/workspace-members.js';

const PLUGIN_PATHS: Readonly<Record<string, string>> = Object.freeze({
    'jterrazz-typescript': createRequire(import.meta.url).resolve('#plugin'),
});

export const PROFILE_CONFIGS: Readonly<Record<Platform, OxlintConfig>> = Object.freeze({
    astro: profile(PROFILES.astro, PLUGIN_PATHS),
    browser: profile(PROFILES.browser, PLUGIN_PATHS),
    bun: profile(PROFILES.bun, PLUGIN_PATHS),
    expo: profile(PROFILES.expo, PLUGIN_PATHS),
    next: profile(PROFILES.next, PLUGIN_PATHS),
    node: profile(PROFILES.node, PLUGIN_PATHS),
    react: profile(PROFILES.react, PLUGIN_PATHS),
});

/** The platform's profile with each JS plugin as the rulebook names it, never the path it resolves to on this machine. */
export const rulebookProfileOf = (platform: Platform): OxlintConfig => profile(PROFILES[platform]);

export const UNSAFE_FIXERS: readonly { rule: string; why: string }[] = unsafeFixers(PROFILES);

const settingsRefusal = (problem: string): Error =>
    new Error(
        refusal({
            ...presetLesson(problem, SETTINGS_FILE),
            read: 'docs/reference/configuration.md#the-merge-order',
        }),
    );

// Stryker disable next-line ConditionalExpression,ArrayDeclaration: the merge reads a value that is no object as nothing, so a preset with no oxlint section merges alike whether it is dropped here or not
const oxlintOf = ({ oxlint }: Preset): OxlintConfig[] => (oxlint === undefined ? [] : [oxlint]);

// invariant: a key left undefined is still a key: a value that is absent leaves no key in the override it would have been part of.
const optional = (key: string, value: unknown): Record<string, unknown> =>
    value === undefined ? {} : { [key]: value };

function projectOxlint({ problem, resolved }: Resolution): ReturnType<typeof projectOxlintOf> {
    if (problem !== null) {
        throw settingsRefusal(problem);
    }
    const own = projectOxlintOf(objectOf(resolved.sections.typescript).oxlint);
    if (own.problem !== null) {
        throw settingsRefusal(own.problem);
    }

    return own;
}

const projectOverridesOf = (resolution: Resolution): OxlintOverride[] =>
    projectOxlint(resolution).overrides.map(({ files, rules }) => ({ files, rules }));

function oxlintConfigOf(resolution: Resolution, { withOverrides = true } = {}): OxlintConfig {
    const { resolved } = resolution;

    return merge(
        PROFILE_CONFIGS[resolved.declaration?.platform ?? 'node'],
        ...resolved.presets.flatMap(oxlintOf),
        {
            ignorePatterns: verbatimTreesOf(resolved.sections.typescript),
            overrides: withOverrides ? projectOverridesOf(resolution) : [],
            rules: projectOxlint(resolution).rules,
        },
    );
}

const within = (member: string, globs: readonly string[]): string[] =>
    globs.map((glob) => `${member}/${glob}`);

// invariant: an override of a member carries the plugins of its member, so a `react/*` rule written in it is read as the member's own config reads it, never ignored for want of its plugin.
function scopedTo(
    member: string,
    override: OxlintOverride,
    plugins: OxlintConfig['plugins'],
): OxlintOverride {
    const { excludeFiles, files, ...rest } = override;

    return {
        ...optional('plugins', plugins),
        ...rest,
        ...optional(
            'excludeFiles',
            excludeFiles === undefined ? undefined : within(member, excludeFiles),
        ),
        files: within(member, files),
    };
}

function memberScoped(member: string, root: OxlintConfig, own: OxlintConfig): OxlintOverride[] {
    // invariant: every rule the root sets is off in the member's folder, and the member's own then stand over it: the member is judged by its rules alone.
    const unset = Object.fromEntries(
        Object.keys(root.rules ?? {}).map((rule) => [rule, 'off' as const]),
    );

    return [
        {
            ...optional('env', own.env),
            files: [`${member}/**`],
            ...optional('globals', own.globals),
            ...optional('jsPlugins', own.jsPlugins),
            ...optional('plugins', own.plugins),
            rules: { ...unset, ...own.rules },
        },
        // Stryker disable next-line ArrayDeclaration: the config a member's folder merges always carries its overrides; the fallback satisfies the optional type
        ...(own.overrides ?? []).map((override) => scopedTo(member, override, own.plugins)),
    ];
}

const RESOLVED_BY_TSCONFIG = 'import/extensions';

// invariant: each folder `typescript.platforms` names is linted by its own platform's profile, the unit's presets and own rules on top.
function withFolderPlatforms(resolution: Resolution, unit: OxlintConfig): OxlintConfig {
    const { folders, problem: unplaced } = folderPlatformsOf(
        objectOf(resolution.resolved.sections.typescript).platforms,
    );
    if (unplaced !== null) {
        throw settingsRefusal(unplaced);
    }
    const { rules = {} } = unit;
    // invariant: a folder compiles under its unit's tsconfig, so the import spelling module resolution decides stays the unit's.
    const kept: OxlintConfig = {
        rules: Object.fromEntries(
            // Stryker disable next-line ConditionalExpression,MethodExpression: a profile re-decides no core rule but import/extensions, so keeping the unit's others leaves the folder's as they are
            Object.entries(rules).filter(([rule]) => rule === RESOLVED_BY_TSCONFIG),
        ),
    };
    const scoped = folders.flatMap(({ folder, platform }) => {
        // invariant: a config reads the platform of its declaration alone; the kind's standard is already in the resolved presets.
        const onIt = { ...resolution.resolved, declaration: { kind: null, platform } };

        return memberScoped(
            folder,
            unit,
            merge(oxlintConfigOf({ ...resolution, resolved: onIt }), kept),
        );
    });

    return merge(unit, { overrides: scoped });
}

export async function oxlintConfigAt(unit: string): Promise<OxlintConfig> {
    const resolution = await readConfig(unit, basePresetsOf);
    const root = withFolderPlatforms(resolution, oxlintConfigOf(resolution));
    // Stryker disable next-line BlockStatement,ConditionalExpression: a unit with no members merges the rulebook's overrides then its own, the order its config already holds, so taking either path for it yields the same config; the early return only spares a second derivation
    if (!isMonorepoRoot(unit)) {
        return root;
    }
    const rulebook = withFolderPlatforms(
        resolution,
        oxlintConfigOf(resolution, { withOverrides: false }),
    );
    const members = workspaceMembers(unit).filter((member) =>
        existsSync(join(unit, member, SETTINGS_FILE)),
    );
    const scoped = await Promise.all(
        members.map(async (member) => {
            const read = await readConfig(join(unit, member), basePresetsOf);
            const own = withFolderPlatforms(read, oxlintConfigOf(read));

            return {
                // Stryker disable next-line ArrayDeclaration: the config a member's folder merges always carries its ignore patterns; the fallback satisfies the optional type
                ignores: within(member, own.ignorePatterns ?? []),
                overrides: memberScoped(member, root, own),
            };
        }),
    );

    return {
        ...root,
        ignorePatterns: [
            // Stryker disable next-line ArrayDeclaration: the root's merged config always carries its ignore patterns; the fallback satisfies the optional type
            ...(root.ignorePatterns ?? []),
            ...scoped.flatMap(({ ignores }) => ignores),
        ],
        // invariant: the rulebook's overrides come first, then each member's, then the ones the root's own settings write: a member's overrides follow the rulebook's as the root's do, and what the repository writes at its root wins over the profile a member's platform brings.
        overrides: [
            // Stryker disable next-line ArrayDeclaration: the rulebook's config always carries its overrides; the fallback satisfies the optional type
            ...(rulebook.overrides ?? []),
            ...scoped.flatMap(({ overrides }) => overrides),
            ...projectOverridesOf(resolution),
        ],
    };
}
