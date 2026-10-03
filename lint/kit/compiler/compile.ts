// hazard: never emits `categories`: a category arms rules of plugins the config never names, which fire unannounced
// once a framework config activates the plugin.

import type { OxlintConfig, OxlintGlobals } from 'oxlint';

import { isJsonObject, isList } from '../project/json.js';
import type { Decision, Fragment } from './decision.js';

type Rules = NonNullable<OxlintConfig['rules']>;

export type Profile = {
    readonly env?: Readonly<Record<string, boolean>>;
    readonly fragments: readonly Fragment[];
    readonly globals?: Readonly<OxlintGlobals>;
    readonly ignorePatterns?: readonly string[];
};

export const OPTIONS: Readonly<NonNullable<OxlintConfig['options']>> = Object.freeze({
    reportUnusedDisableDirectives: 'error',
    typeAware: true,
});

const CONCAT_DEDUPE = new Set(['extends', 'ignorePatterns', 'jsPlugins', 'plugins']);
// invariant: order matters: no dedupe.
const CONCAT = new Set(['overrides']);
// invariant: the last config wins per key.
const SHALLOW_MERGE = new Set(['env', 'globals', 'options', 'rules', 'settings']);

export function compile(
    fragment: Fragment,
    pluginPaths: Readonly<Record<string, string>> = {},
): OxlintConfig {
    const config: OxlintConfig = { rules: rulesOf(fragment.decisions) };

    if (fragment.plugins.length > 0) {
        config.plugins = [...fragment.plugins];
    }
    if (fragment.jsPlugins.length > 0) {
        config.jsPlugins = fragment.jsPlugins.map((plugin) => pluginPaths[plugin] ?? plugin);
    }
    if (fragment.ignorePatterns.length > 0) {
        config.ignorePatterns = [...fragment.ignorePatterns];
    }
    if (fragment.overrides.length > 0) {
        config.overrides = fragment.overrides.map((override) => ({
            files: [...override.files],
            rules: rulesOf(override.decisions),
        }));
    }
    if (fragment.settings !== undefined) {
        config.settings = fragment.settings;
    }
    if (fragment.options !== undefined) {
        config.options = fragment.options;
    }
    if (fragment.env !== undefined) {
        config.env = fragment.env;
    }
    if (fragment.globals !== undefined) {
        config.globals = { ...fragment.globals };
    }

    return config;
}

export function merge(...configs: readonly OxlintConfig[]): OxlintConfig {
    const merged: Record<string, unknown> = {};
    for (const config of configs) {
        if (!isJsonObject(config)) {
            continue;
        }
        for (const [key, value] of Object.entries(config)) {
            if (value !== undefined) {
                merged[key] = mergeKey(key, merged[key], value);
            }
        }
    }
    return merged;
}

function mergeKey(key: string, previous: unknown, value: unknown): unknown {
    if (CONCAT_DEDUPE.has(key)) {
        const combined = [...asArray(previous), ...asArray(value)];
        return combined.filter((entry, index) => combined.indexOf(entry) === index);
    }
    if (CONCAT.has(key)) {
        return [...asArray(previous), ...asArray(value)];
    }
    if (SHALLOW_MERGE.has(key)) {
        return { ...objectOf(previous), ...objectOf(value) };
    }
    return value;
}

function asArray(value: unknown): unknown[] {
    if (value === undefined) {
        return [];
    }
    return isList(value) ? [...value] : [value];
}

function objectOf(value: unknown): object {
    return typeof value === 'object' && value !== null ? value : {};
}

export function profile(
    { fragments, env, globals, ignorePatterns = [] }: Profile,
    pluginPaths: Readonly<Record<string, string>> = {},
): OxlintConfig {
    const closing: OxlintConfig = {
        ...(env === undefined ? {} : { env: { ...env } }),
        ...(globals === undefined ? {} : { globals: { ...globals } }),
        ignorePatterns: [...ignorePatterns],
        options: { ...OPTIONS },
    };

    return merge(...fragments.map((one) => compile(one, pluginPaths)), closing);
}

function rulesOf(decisions: Readonly<Record<string, Decision>>): Rules {
    const rules: Rules = {};
    for (const [rule, decision] of Object.entries(decisions)) {
        if (decision.level === 'off') {
            rules[rule] = 'off';
        } else if (decision.options === undefined) {
            rules[rule] = 'error';
        } else if (isList(decision.options)) {
            rules[rule] = ['error', ...decision.options];
        } else {
            rules[rule] = ['error', decision.options];
        }
    }
    return rules;
}
