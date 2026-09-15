/*
 * Fragment -> oxlint config. The compiler is the only place a rule level is
 * spelled, and it never emits `categories`: a category switch arms rules of
 * plugins the config never names, inert until a framework config activates the
 * plugin and then firing unannounced. Every rule of this package is decided by
 * name ([Lint presets](../docs/07-lint-presets.md)).
 */

/** The linter options every profile ships: type information on, dead directives refused. */
export const OPTIONS = Object.freeze({
    reportUnusedDisableDirectives: 'error',
    typeAware: true,
});

/** Config keys concatenated across configs, duplicates dropped (===). */
const CONCAT_DEDUPE = new Set(['extends', 'ignorePatterns', 'jsPlugins', 'plugins']);
/** Config keys concatenated verbatim — order matters, no dedupe. */
const CONCAT = new Set(['overrides']);
/** Config keys shallow-merged as objects — the LAST config wins per key. */
const SHALLOW_MERGE = new Set(['env', 'globals', 'options', 'rules', 'settings']);

/** One fragment as the plain oxlint config object oxlint itself reads. */
export function compile(fragment) {
    const config = { rules: rulesOf(fragment.decisions) };

    if (fragment.plugins.length > 0) {
        config.plugins = [...fragment.plugins];
    }
    if (fragment.jsPlugins.length > 0) {
        config.jsPlugins = [...fragment.jsPlugins];
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
    if (fragment.settings) {
        config.settings = fragment.settings;
    }
    if (fragment.options) {
        config.options = fragment.options;
    }
    if (fragment.env) {
        config.env = fragment.env;
    }
    if (fragment.globals) {
        config.globals = fragment.globals;
    }

    return config;
}

/**
 * Deterministic merge of oxlint config objects, left to right:
 * `jsPlugins` / `plugins` / `ignorePatterns` / `extends` concatenated and
 * deduped, `rules` / `env` / `globals` / `options` / `settings` shallow-merged
 * with last-wins per key, `overrides` concatenated, any other key taken from
 * the last config that sets it.
 */
export function merge(...configs) {
    const merged = {};
    for (const config of configs) {
        if (!config || typeof config !== 'object') {
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

/** How one key merges: the three tables above, then last-wins. */
function mergeKey(key, previous, value) {
    if (CONCAT_DEDUPE.has(key)) {
        const combined = [...asArray(previous), ...asArray(value)];
        return combined.filter((entry, index) => combined.indexOf(entry) === index);
    }
    if (CONCAT.has(key)) {
        return [...asArray(previous), ...asArray(value)];
    }
    if (SHALLOW_MERGE.has(key)) {
        return { ...previous, ...value };
    }
    return value;
}

function asArray(value) {
    if (value === undefined) {
        return [];
    }
    return Array.isArray(value) ? value : [value];
}

/** A profile: fragments compiled, merged, and given the linter options. */
export function profile({ fragments, env, globals, ignorePatterns = [] }) {
    return merge(...fragments.map((one) => compile(one)), {
        env,
        globals,
        ignorePatterns,
        options: { ...OPTIONS },
    });
}

function rulesOf(decisions) {
    const rules = {};
    for (const [rule, decision] of Object.entries(decisions)) {
        if (decision.level === 'off') {
            rules[rule] = 'off';
        } else if (decision.options === undefined) {
            rules[rule] = 'error';
        } else if (Array.isArray(decision.options)) {
            rules[rule] = ['error', ...decision.options];
        } else {
            rules[rule] = ['error', decision.options];
        }
    }
    return rules;
}
