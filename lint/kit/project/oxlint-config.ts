import { execFileSync } from 'node:child_process';
import { matchesGlob } from 'node:path';

import { isJsonObject, objectOf, parsedObject, stringsOf } from './json.js';

export type PrintedRules = Record<string, unknown>;

export type PrintedOxlintConfig = {
    jsPlugins?: unknown[];
    overrides?: { files?: string | string[]; rules?: PrintedRules }[];
    plugins?: string[];
    rules?: PrintedRules;
};

type PrintedOverride = NonNullable<PrintedOxlintConfig['overrides']>[number];

function printedOverride(entry: unknown): PrintedOverride {
    const { files, rules } = objectOf(entry);

    return {
        ...(typeof files === 'string' ? { files } : {}),
        ...(Array.isArray(files) ? { files: stringsOf(files) } : {}),
        ...(isJsonObject(rules) ? { rules: { ...rules } } : {}),
    };
}

function printedConfig(printed: string): PrintedOxlintConfig {
    const { jsPlugins, overrides, plugins, rules } = parsedObject(printed);

    return {
        ...(Array.isArray(jsPlugins) ? { jsPlugins } : {}),
        ...(Array.isArray(overrides)
            ? { overrides: overrides.map((entry) => printedOverride(entry)) }
            : {}),
        ...(Array.isArray(plugins) ? { plugins: stringsOf(plugins) } : {}),
        ...(isJsonObject(rules) ? { rules: { ...rules } } : {}),
    };
}

export function printedOxlintConfig(
    root: string,
    oxlint: string,
    configPath?: null | string,
): null | PrintedOxlintConfig {
    try {
        const printed = execFileSync(
            oxlint,
            configPath === null || configPath === undefined
                ? ['--print-config']
                : ['-c', configPath, '--print-config'],
            { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
        );

        return printedConfig(printed);
    } catch {
        return null;
    }
}

type Override = { files: string[]; rules: PrintedRules };

export type Resolved = {
    namespaces: ReadonlySet<string>;
    overrides: Override[];
    rules: PrintedRules;
};

export type Applied = { namespaces: ReadonlySet<string>; rules: PrintedRules };

const asOxlintGlob = (glob: string): string => (glob.includes('/') ? glob : `**/${glob}`);

// A JS plugin's rules never appear in `--print-config`: its directives are unverifiable, never dead.
export function resolveConfig(
    root: string,
    oxlint: string,
    config: string | undefined,
): null | Resolved {
    const resolved = printedOxlintConfig(root, oxlint, config);
    if (resolved === null) {
        return null;
    }

    const overrides = (resolved.overrides ?? []).map((override) => ({
        files: [override.files ?? []].flat().map((glob) => asOxlintGlob(glob)),
        rules: { ...override.rules },
    }));
    const decided = { ...resolved.rules };
    for (const override of overrides) {
        Object.assign(decided, override.rules);
    }

    return { namespaces: namespacesOf(resolved, decided), overrides, rules: { ...resolved.rules } };
}

// A directive is judged by the rules of the file it was written in: overrides match by path, the later wins.
export function configAt(path: string, config: null | Resolved): Applied | null {
    if (config === null) {
        return null;
    }

    const rules = { ...config.rules };
    for (const override of config.overrides) {
        if (override.files.some((glob) => matchesGlob(path, glob))) {
            Object.assign(rules, override.rules);
        }
    }

    return { namespaces: config.namespaces, rules };
}

// With a JS plugin loaded, a namespace oxlint did not print is that plugin's and answers nothing.
function namespacesOf(resolved: PrintedOxlintConfig, rules: PrintedRules): ReadonlySet<string> {
    const namespaces = new Set<string>();
    for (const name of Object.keys(rules)) {
        if (name.includes('/')) {
            namespaces.add(name.split('/')[0] ?? '');
        }
    }

    if ((resolved.jsPlugins?.length ?? 0) === 0) {
        return namespaces;
    }

    const loaded = new Set(resolved.plugins);

    return new Set([...namespaces].filter((namespace) => loaded.has(namespace)));
}
