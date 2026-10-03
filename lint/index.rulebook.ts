import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import type { OxlintConfig, OxlintOverride } from 'oxlint';

import { basePresetsOf } from './consumer/catalogue/preset.js';
import { PROFILES } from './consumer/rulebook/profiles.js';
import { unsafeFixers } from './kit/catalogue/decisions.js';
import { refusal } from './kit/catalogue/lesson.js';
import { merge, profile } from './kit/compiler/compile.js';
import type { Platform } from './kit/project/declaration.js';
import { objectOf } from './kit/project/json.js';
import { readConfig, SETTINGS_FILE } from './kit/project/jterrazz-config.js';
import { presetLesson } from './kit/project/preset.js';
import type { Resolution } from './kit/project/preset.js';
import { projectOxlintOf } from './kit/project/project-oxlint.js';
import { workspaceMembers } from './kit/project/workspace-members.js';

const PLUGIN_PATHS: Readonly<Record<string, string>> = Object.freeze({
    'jterrazz-typescript': createRequire(import.meta.url).resolve('#plugin'),
});

export const PROFILE_CONFIGS: Readonly<Record<Platform, OxlintConfig>> = Object.freeze({
    astro: profile(PROFILES.astro, PLUGIN_PATHS),
    bun: profile(PROFILES.bun, PLUGIN_PATHS),
    expo: profile(PROFILES.expo, PLUGIN_PATHS),
    next: profile(PROFILES.next, PLUGIN_PATHS),
    node: profile(PROFILES.node, PLUGIN_PATHS),
    react: profile(PROFILES.react, PLUGIN_PATHS),
});

export const UNSAFE_FIXERS: readonly { rule: string; why: string }[] = unsafeFixers(PROFILES);

const settingsRefusal = (problem: string): Error =>
    new Error(
        refusal({
            ...presetLesson(problem, SETTINGS_FILE),
            read: 'docs/06-configuration.md#the-merge-order',
        }),
    );

export function oxlintConfigOf({ problem, resolved }: Resolution): OxlintConfig {
    if (problem !== null) {
        throw settingsRefusal(problem);
    }
    const own = projectOxlintOf(objectOf(resolved.sections.typescript).oxlint);
    if (own.problem !== null) {
        throw settingsRefusal(own.problem);
    }
    const overrides: OxlintOverride[] = own.overrides.map(({ files, rules }) => ({ files, rules }));

    return merge(
        PROFILE_CONFIGS[resolved.declaration?.platform ?? 'node'],
        ...resolved.presets.flatMap((preset) =>
            preset.oxlint === undefined ? [] : [preset.oxlint],
        ),
        { overrides, rules: own.rules },
    );
}

const within = (member: string, globs: readonly string[]): string[] =>
    globs.map((glob) => `${member}/${glob}`);

function scopedTo(member: string, override: OxlintOverride): OxlintOverride {
    const { excludeFiles, files, ...rest } = override;

    return {
        ...rest,
        ...(excludeFiles === undefined ? {} : { excludeFiles: within(member, excludeFiles) }),
        files: within(member, files),
    };
}

function memberScoped(member: string, root: OxlintConfig, own: OxlintConfig): OxlintOverride[] {
    const unset = Object.fromEntries(
        Object.keys(root.rules ?? {})
            .filter((rule) => own.rules?.[rule] === undefined)
            .map((rule) => [rule, 'off' as const]),
    );

    return [
        {
            ...(own.env === undefined ? {} : { env: own.env }),
            files: [`${member}/**`],
            ...(own.globals === undefined ? {} : { globals: own.globals }),
            ...(own.jsPlugins === undefined ? {} : { jsPlugins: own.jsPlugins }),
            ...(own.plugins === undefined ? {} : { plugins: own.plugins }),
            rules: { ...unset, ...own.rules },
        },
        ...(own.overrides ?? []).map((override) => scopedTo(member, override)),
    ];
}

export async function oxlintConfigAt(unit: string): Promise<OxlintConfig> {
    const resolution = await readConfig(unit, basePresetsOf);
    const root = oxlintConfigOf(resolution);
    if (resolution.resolved.declaration?.kind !== 'workspace') {
        return root;
    }
    const members = workspaceMembers(unit).filter((member) =>
        existsSync(join(unit, member, SETTINGS_FILE)),
    );
    const scoped = await Promise.all(
        members.map(async (member) => {
            const own = oxlintConfigOf(await readConfig(join(unit, member), basePresetsOf));

            return {
                ignores: within(member, own.ignorePatterns ?? []),
                overrides: memberScoped(member, root, own),
            };
        }),
    );

    return {
        ...root,
        ignorePatterns: [
            ...(root.ignorePatterns ?? []),
            ...scoped.flatMap(({ ignores }) => ignores),
        ],
        overrides: [...(root.overrides ?? []), ...scoped.flatMap(({ overrides }) => overrides)],
    };
}
