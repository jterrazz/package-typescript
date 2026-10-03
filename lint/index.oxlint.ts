import { fileURLToPath } from 'node:url';
import { defineConfig } from 'oxlint';
import type { OxlintConfig } from 'oxlint';

import { BASE_PRESETS } from './consumer/catalogue/preset.js';
import { PROFILES } from './consumer/rulebook/profiles.js';
import { unsafeFixers } from './kit/catalogue/decisions.js';
import { refusal } from './kit/catalogue/lesson.js';
import { merge, profile } from './kit/compiler/compile.js';
import { SETTINGS_FILE } from './kit/project/jterrazz-config.js';
import { presetLesson, resolveConfig } from './kit/project/preset.js';

/** Merges oxlint configs left to right: lists concatenated and deduped, maps shallow-merged with the last winning. */
export { merge as compose } from './kit/compiler/compile.js';

// A consumer's bare `from 'oxlint'` resolves only where it declares oxlint itself, which pnpm refuses to assume.
export { defineConfig } from 'oxlint';
export type { OxlintConfig, OxlintOverride } from 'oxlint';

/** A rule entry as oxlint reads it: a level, or a level and its options. */
export type RuleEntry = NonNullable<OxlintConfig['rules']>[string];

const PLUGIN_PATHS: Readonly<Record<string, string>> = Object.freeze({
    'jterrazz-typescript': fileURLToPath(new URL('plugin.js', import.meta.url)),
});

export const astro: OxlintConfig = defineConfig(profile(PROFILES.astro, PLUGIN_PATHS));
export const bun: OxlintConfig = defineConfig(profile(PROFILES.bun, PLUGIN_PATHS));
export const expo: OxlintConfig = defineConfig(profile(PROFILES.expo, PLUGIN_PATHS));
export const next: OxlintConfig = defineConfig(profile(PROFILES.next, PLUGIN_PATHS));
export const node: OxlintConfig = defineConfig(profile(PROFILES.node, PLUGIN_PATHS));
export const react: OxlintConfig = defineConfig(profile(PROFILES.react, PLUGIN_PATHS));

/** A profile for a nested oxlint.config: without the `options` oxlint accepts at the root only. */
export function nested(config: OxlintConfig): OxlintConfig {
    const { options: _rootOnly, ...subtree } = config;

    return subtree;
}

const BY_PROFILE: Readonly<Record<string, OxlintConfig>> = Object.freeze({
    astro,
    bun,
    expo,
    next,
    node,
    react,
});

const presetRefusal = (problem: string): Error =>
    new Error(
        refusal({
            ...presetLesson(problem, SETTINGS_FILE),
            read: 'docs/06-configuration.md#the-merge-order',
        }),
    );

/** The oxlint config a settings file's presets compose: the base preset's profile, then each preset's own, in the merge order. */
export function fromPresets(config: object): OxlintConfig {
    const { problem, resolved } = resolveConfig(config, BASE_PRESETS);
    if (problem !== null) {
        throw presetRefusal(problem);
    }
    const named = resolved.sections.typescript?.profile;
    const chosen = typeof named === 'string' ? BY_PROFILE[named] : undefined;
    if (chosen === undefined) {
        throw presetRefusal(
            `names the profile \`${String(named)}\`, which is none of ${Object.keys(BY_PROFILE).join(', ')}`,
        );
    }

    return merge(
        chosen,
        ...resolved.presets.flatMap((preset) =>
            preset.oxlint === undefined ? [] : [preset.oxlint],
        ),
    );
}

export const UNSAFE_FIXERS = unsafeFixers(PROFILES);
