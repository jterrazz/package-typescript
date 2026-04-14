#!/usr/bin/env node

/**
 * Merges the codestyle base knip config with an optional project-local knip.json,
 * then applies dynamic detection rules based on the project's package.json and file structure.
 *
 * Usage: node merge-knip-config.js <base.json> [project-knip.json]
 *
 * Merge rules:
 *   - Arrays (ignoreDependencies, ignoreBinaries, ignore): concatenated and deduplicated
 *   - Objects (rules, vitest, etc.): project values override base
 *   - Scalars (project, entry): project value wins
 *   - $schema is always stripped from output
 *
 * Dynamic detection:
 *   - Published library (main/exports/publishConfig) → disable exports/types/files rules
 *   - Auto-ignore docs/**, fixtures/**, expected/** convention paths
 *   - Vitest workspace workaround → explicit vitest config when vitest is a dependency
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';

const basePath = process.argv[2];
const projectPath = process.argv[3];

const base = JSON.parse(readFileSync(basePath, 'utf8'));

let project = {};
if (projectPath) {
    project = JSON.parse(readFileSync(projectPath, 'utf8'));
}

const ARRAY_KEYS = new Set(['ignore', 'ignoreBinaries', 'ignoreDependencies', 'entry', 'project']);

const merged = {};
const allKeys = new Set([...Object.keys(base), ...Object.keys(project)]);

for (const key of allKeys) {
    if (key === '$schema') {
        continue;
    }

    const bVal = base[key];
    const pVal = project[key];

    if (pVal === undefined) {
        merged[key] = bVal;
    } else if (bVal === undefined) {
        merged[key] = pVal;
    } else if (ARRAY_KEYS.has(key) && Array.isArray(bVal) && Array.isArray(pVal)) {
        merged[key] = [...new Set([...bVal, ...pVal])];
    } else if (typeof bVal === 'object' && typeof pVal === 'object' && !Array.isArray(bVal)) {
        merged[key] = { ...bVal, ...pVal };
    } else {
        merged[key] = pVal;
    }
}

// --- Dynamic detection ---

let pkg = {};
if (existsSync('package.json')) {
    pkg = JSON.parse(readFileSync('package.json', 'utf8'));
}

// 1. Published library → disable exports/types/files rules
if (pkg.main || pkg.exports || pkg.publishConfig) {
    merged.rules = { exports: 'off', files: 'off', types: 'off', ...merged.rules };
}

// 2. Auto-ignore convention paths that exist on disk
const conventionIgnores = [];
if (existsSync('docs')) {
    conventionIgnores.push('docs/**');
}

// Scan for fixtures/** and expected/** directories anywhere in the tree (up to 3 levels)
const scanDirs = ['tests', 'test', 'src'];
for (const root of scanDirs) {
    if (!existsSync(root)) {
        continue;
    }
    findConventionDirs(root, 0);
}

function findConventionDirs(dir, depth) {
    if (depth > 3) {
        return;
    }
    let entries;
    try {
        entries = readdirSync(dir, { withFileTypes: true });
    } catch {
        return;
    }
    for (const entry of entries) {
        if (!entry.isDirectory()) {
            continue;
        }
        if (entry.name === 'fixtures' || entry.name === 'expected') {
            conventionIgnores.push(`${dir}/${entry.name}/**`);
        } else if (entry.name !== 'node_modules') {
            findConventionDirs(`${dir}/${entry.name}`, depth + 1);
        }
    }
}

if (conventionIgnores.length > 0) {
    const existing = merged.ignore || [];
    merged.ignore = [...new Set([...existing, ...conventionIgnores])];
}

// 3. Vitest workspace workaround — knip crashes on vitest.workspace.ts
//    If vitest is a dependency, explicitly set the vitest config to avoid the workspace file
const allDeps = { ...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies };
if (allDeps.vitest && !merged.vitest) {
    if (existsSync('vitest.config.ts')) {
        merged.vitest = { config: ['vitest.config.ts'] };
    } else if (existsSync('vitest.config.js')) {
        merged.vitest = { config: ['vitest.config.js'] };
    } else if (existsSync('vitest.workspace.ts')) {
        merged.vitest = { config: ['vitest.workspace.ts'] };
    } else if (existsSync('vitest.workspace.js')) {
        merged.vitest = { config: ['vitest.workspace.js'] };
    }
}

// Also ignore vitest.workspace.ts if it exists (knip can't parse it)
if (existsSync('vitest.workspace.ts') || existsSync('vitest.workspace.js')) {
    const existing = merged.ignore || [];
    const wsFile = existsSync('vitest.workspace.ts')
        ? 'vitest.workspace.ts'
        : 'vitest.workspace.js';
    merged.ignore = [...new Set([...existing, wsFile])];
}

// 4. Playwright at non-standard paths + string-referenced global hooks.
//    Knip auto-discovers `playwright.config.ts` at the repo root, but
//    projects that keep their browser tests under a dedicated subdir
//    (e.g. `web/playwright.config.ts`, `e2e/playwright.config.ts`,
//    `tests/playwright.config.ts`) need an explicit entry. The global
//    setup/teardown files next to that config are referenced as plain
//    strings from `playwright.config.ts`, so knip can't trace them —
//    add them as entries when they exist.
if (allDeps['@playwright/test'] || allDeps.playwright) {
    const playwrightSearchPaths = [
        'web/playwright.config.ts',
        'web/playwright.config.js',
        'e2e/playwright.config.ts',
        'e2e/playwright.config.js',
        'tests/playwright.config.ts',
        'tests/playwright.config.js',
    ];
    const playwrightEntries = [];
    for (const configPath of playwrightSearchPaths) {
        if (!existsSync(configPath)) {
            continue;
        }
        playwrightEntries.push(configPath);
        const configDir = configPath.slice(0, configPath.lastIndexOf('/'));
        for (const hook of [
            `${configDir}/setup/global-setup.ts`,
            `${configDir}/setup/global-teardown.ts`,
            `${configDir}/setup/global-setup.js`,
            `${configDir}/setup/global-teardown.js`,
        ]) {
            if (existsSync(hook)) {
                playwrightEntries.push(hook);
            }
        }
    }
    if (playwrightEntries.length > 0) {
        const existing = merged.entry || [];
        merged.entry = [...new Set([...existing, ...playwrightEntries])];
    }
}

// 5. Auto-ignore plugin/addon dependencies for known parent packages
const prodDeps = Object.keys(pkg.dependencies || {});
const devDeps = Object.keys(pkg.devDependencies || {});
const peerDeps = Object.keys(pkg.peerDependencies || {});
const allDepNames = Object.keys(allDeps);
const autoIgnoreDeps = [];

// DevDependencies that are also peerDependencies (installed locally for testing)
for (const dep of devDeps) {
    if (peerDeps.includes(dep)) {
        autoIgnoreDeps.push(dep);
    }
}

for (const dep of [...prodDeps, ...devDeps]) {
    // @scope/sub-package when the unscoped root is a peer or dependency
    // E.g. @hono/node-server → hono
    const scopeMatch = dep.match(/^@([^/]+)\//);
    if (scopeMatch && (peerDeps.includes(scopeMatch[1]) || allDepNames.includes(scopeMatch[1]))) {
        autoIgnoreDeps.push(dep);
        continue;
    }

    // <parent>-plugin-* or <parent>-preset-* when <parent> is installed
    // E.g. vitepress-plugin-llms → vitepress
    const pluginMatch = dep.match(/^(.+?)-(plugin|preset|transformer|loader)-/);
    if (pluginMatch && allDepNames.includes(pluginMatch[1])) {
        autoIgnoreDeps.push(dep);
        continue;
    }

    // eslint-plugin-* — always a runtime plugin loaded by config, never imported
    if (dep.startsWith('eslint-plugin-')) {
        autoIgnoreDeps.push(dep);
    }
}

// 5. Auto-ignore production dependencies that provide binaries
//    When a binary-only tool is in "dependencies", it's shipped for consumers (e.g. codestyle ships oxlint)
for (const dep of prodDeps) {
    if (autoIgnoreDeps.includes(dep)) {
        continue;
    }
    try {
        const depPkg = JSON.parse(readFileSync(`node_modules/${dep}/package.json`, 'utf8'));
        if (depPkg.bin && Object.keys(depPkg.bin).length > 0) {
            autoIgnoreDeps.push(dep);
        }
    } catch {
        // Dep not installed locally — skip
    }
}

if (autoIgnoreDeps.length > 0) {
    const existing = merged.ignoreDependencies || [];
    merged.ignoreDependencies = [...new Set([...existing, ...autoIgnoreDeps])];
}

process.stdout.write(JSON.stringify(merged));
