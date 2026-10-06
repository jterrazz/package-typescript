import { existsSync, readdirSync, readFileSync } from 'node:fs';
import type { Dirent } from 'node:fs';

import { messageOf, refusal } from '../../../lint/kit/catalogue/lesson.js';
import { isGroundFolder } from '../../../lint/kit/project/ground.js';
import { isList, objectOf, parsedObject } from '../../../lint/kit/project/json.js';
import type { JsonObject } from '../../../lint/kit/project/json.js';
import { workspaceMembers } from '../../../lint/kit/project/workspace-members.js';
import { KNIP_PRESET } from '../../presets/knip/config.js';
import type { KnipSettings } from './settings.js';

type KnipConfig = Record<string, unknown>;

const UNSCANNED: ReadonlySet<string> = new Set(['dist', 'node_modules']);

const ARRAY_KEYS: ReadonlySet<string> = new Set([
    'ignore',
    'ignoreBinaries',
    'ignoreDependencies',
    'entry',
    'project',
]);

const VITEST_CONFIGS = ['vitest.config.ts', 'vitest.config.js'];

const VITEST_WORKSPACES = ['vitest.workspace.ts', 'vitest.workspace.js'];

const PLAYWRIGHT_CONFIGS = [
    'web/playwright.config.ts',
    'web/playwright.config.js',
    'e2e/playwright.config.ts',
    'e2e/playwright.config.js',
    'tests/playwright.config.ts',
    'tests/playwright.config.js',
];

const PLAYWRIGHT_HOOKS = [
    'setup/global-setup.ts',
    'setup/global-teardown.ts',
    'setup/global-setup.js',
    'setup/global-teardown.js',
];

function mergedValue(key: string, base: unknown, project: unknown): unknown {
    if (project === undefined) {
        return base;
    }
    if (base === undefined) {
        return project;
    }
    if (ARRAY_KEYS.has(key) && isList(base) && isList(project)) {
        return [...new Set([...base, ...project])];
    }
    if (typeof base === 'object' && typeof project === 'object' && !Array.isArray(base)) {
        return { ...base, ...project };
    }

    return project;
}

function mergedConfigs(base: KnipConfig, project: KnipConfig): KnipConfig {
    const merged: KnipConfig = {};
    for (const key of new Set([...Object.keys(base), ...Object.keys(project)])) {
        if (key !== '$schema') {
            merged[key] = mergedValue(key, base[key], project[key]);
        }
    }

    return merged;
}

function listOf(value: unknown): readonly unknown[] {
    return isList(value) ? value : [];
}

function withEntries(merged: KnipConfig, key: string, added: readonly unknown[]): void {
    if (added.length > 0) {
        merged[key] = [...new Set([...listOf(merged[key]), ...added])];
    }
}

function groundIgnores(dir: string, depth: number): string[] {
    if (depth > 6) {
        return [];
    }
    let entries: Dirent[];
    try {
        entries = readdirSync(dir, { withFileTypes: true });
    } catch {
        return [];
    }

    return entries
        .filter((entry) => entry.isDirectory())
        .flatMap((entry) => {
            const path = dir === '.' ? entry.name : `${dir}/${entry.name}`;
            if (isGroundFolder(entry.name)) {
                return [`${path}/**`];
            }

            return UNSCANNED.has(entry.name) || entry.name.startsWith('.')
                ? []
                : groundIgnores(path, depth + 1);
        });
}

// outside: Knip resolves `ignore` globs from the root, so a member's paths carry its prefix.
function conventionIgnores(): string[] {
    const ignores: string[] = [];
    for (const unit of ['.', ...workspaceMembers('.')]) {
        const prefix = unit === '.' ? '' : `${unit}/`;
        if (existsSync(`${prefix}docs`)) {
            ignores.push(`${prefix}docs/**`);
        }
        // outside: the preset's `entry` names the root's settings file and reaches no member's.
        if (prefix !== '' && existsSync(`${prefix}jterrazz.config.ts`)) {
            ignores.push(`${prefix}jterrazz.config.ts`);
        }
        ignores.push(...groundIgnores(unit, 0));
    }

    return ignores;
}

function manifestHere(): JsonObject {
    if (!existsSync('package.json')) {
        return {};
    }
    try {
        return parsedObject(readFileSync('package.json', 'utf8'));
    } catch (error) {
        throw new SyntaxError(
            refusal({
                fix: 'repair package.json, then run again',
                found: `package.json does not parse: ${messageOf(error)}`,
                read: 'docs/reference/lint-presets.md#unused-code-knip',
                why: 'knip is handed the preset merged with what the project declares, and would judge the project against a config it never wrote',
            }),
            { cause: error },
        );
    }
}

function dependencyNames(manifest: JsonObject, field: string): string[] {
    return Object.keys(objectOf(manifest[field]));
}

function declaredOf(manifest: JsonObject): JsonObject {
    return {
        ...objectOf(manifest.dependencies),
        ...objectOf(manifest.devDependencies),
        ...objectOf(manifest.peerDependencies),
    };
}

// outside: knip crashes on vitest.workspace.ts, so a vitest dependency gets an explicit config.
function withVitest(merged: KnipConfig, declared: JsonObject): void {
    if (declared.vitest !== undefined && merged.vitest === undefined) {
        const config = [...VITEST_CONFIGS, ...VITEST_WORKSPACES].find((name) => existsSync(name));
        if (config !== undefined) {
            merged.vitest = { config: [config] };
        }
    }
    const workspace = VITEST_WORKSPACES.find((name) => existsSync(name));
    if (workspace !== undefined) {
        withEntries(merged, 'ignore', [workspace]);
    }
}

// outside: global setup/teardown are named as strings in the Playwright config, which knip cannot trace.
function withPlaywright(merged: KnipConfig, declared: JsonObject): void {
    if (declared['@playwright/test'] === undefined && declared.playwright === undefined) {
        return;
    }
    const entries: string[] = [];
    for (const path of PLAYWRIGHT_CONFIGS.filter((config) => existsSync(config))) {
        const directory = path.slice(0, path.lastIndexOf('/'));
        entries.push(
            path,
            ...PLAYWRIGHT_HOOKS.map((hook) => `${directory}/${hook}`).filter((hook) =>
                existsSync(hook),
            ),
        );
    }
    withEntries(merged, 'entry', entries);
}

// outside: DefinitelyTyped names `@scope/name`'s types `@types/scope__name`; the compiler reads them, nothing imports them.
const typedName = (dependency: string): string | undefined =>
    /^@types\/(?<name>.+)$/u
        .exec(dependency)
        ?.groups?.name?.replace(/^(?<scope>[^_]+)__/u, '@$<scope>/');

function derivesFromAnother(
    dependency: string,
    names: readonly string[],
    peers: readonly string[],
): boolean {
    const typed = typedName(dependency);
    if (typed !== undefined && names.includes(typed)) {
        return true;
    }
    const scope = /^@(?<scope>[^/]+)\//u.exec(dependency)?.groups?.scope;
    if (scope !== undefined && (peers.includes(scope) || names.includes(scope))) {
        return true;
    }
    const parent = /^(?<parent>.+?)-(?:plugin|preset|transformer|loader)-/u.exec(dependency)?.groups
        ?.parent;
    if (parent !== undefined && names.includes(parent)) {
        return true;
    }

    // outside: an eslint plugin is loaded by a config, never imported.
    return dependency.startsWith('eslint-plugin-');
}

// invariant: a binary-only tool in `dependencies` is shipped for consumers to run, never imported.
function shipsABinary(dependency: string): boolean {
    try {
        const { bin } = parsedObject(
            readFileSync(`node_modules/${dependency}/package.json`, 'utf8'),
        );

        return typeof bin === 'string'
            ? bin.length > 0
            : typeof bin === 'object' && bin !== null && Object.keys(bin).length > 0;
    } catch {
        return false;
    }
}

function ignoredDependencies(manifest: JsonObject): string[] {
    const production = dependencyNames(manifest, 'dependencies');
    const development = dependencyNames(manifest, 'devDependencies');
    const peers = dependencyNames(manifest, 'peerDependencies');
    const names = Object.keys(declaredOf(manifest));
    // invariant: a devDependency that is also a peer is installed only to test against.
    const ignored = development.filter((dependency) => peers.includes(dependency));
    for (const dependency of [...production, ...development]) {
        if (derivesFromAnother(dependency, names, peers)) {
            ignored.push(dependency);
        }
    }

    return [
        ...ignored,
        ...production.filter(
            (dependency) => !ignored.includes(dependency) && shipsABinary(dependency),
        ),
    ];
}

export function mergedKnipConfig({
    entries,
    settings,
}: {
    entries: readonly string[];
    settings: KnipSettings;
}): KnipConfig {
    const merged = mergedConfigs(KNIP_PRESET, {
        ...settings,
        entry: [...entries, ...settings.entry],
    });
    const manifest = manifestHere();
    withEntries(merged, 'ignore', conventionIgnores());
    const declared = declaredOf(manifest);
    withVitest(merged, declared);
    withPlaywright(merged, declared);
    withEntries(merged, 'ignoreDependencies', ignoredDependencies(manifest));

    return merged;
}
