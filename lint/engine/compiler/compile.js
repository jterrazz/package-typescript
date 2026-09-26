// Never emits `categories`: a category arms rules of plugins the config never names, which fire unannounced
// once a framework config activates the plugin.

export const OPTIONS = Object.freeze({
    reportUnusedDisableDirectives: 'error',
    typeAware: true,
});

const CONCAT_DEDUPE = new Set(['extends', 'ignorePatterns', 'jsPlugins', 'plugins']);
// Order matters: no dedupe.
const CONCAT = new Set(['overrides']);
// The last config wins per key.
const SHALLOW_MERGE = new Set(['env', 'globals', 'options', 'rules', 'settings']);

export function compile(fragment, pluginPaths = {}) {
    const config = { rules: rulesOf(fragment.decisions) };

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

export function profile({ fragments, env, globals, ignorePatterns = [] }, pluginPaths = {}) {
    return merge(...fragments.map((one) => compile(one, pluginPaths)), {
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
