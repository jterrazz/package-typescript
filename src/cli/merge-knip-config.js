#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync } from 'node:fs';

import { workspaceMembers } from './workspace-members.js';

// The folders @jterrazz/test reserves for what a test stands on.
const GROUND = new Set(['expected', 'fixtures', 'requests', 'seeds']);

const UNSCANNED = new Set(['dist', 'node_modules']);

// A comment marker inside a string (`"**/*.js"`) is data.
function withoutComments(text) {
    let output = '';
    let index = 0;
    let inString = false;

    while (index < text.length) {
        const char = text[index];

        if (inString) {
            const step = inStringStep(text, index);
            output += step.kept;
            inString = step.open;
            index = step.next;
        } else if (char === '"') {
            inString = true;
            output += char;
            index += 1;
        } else if (opens(text, index, '//')) {
            index = afterLine(text, index);
        } else if (opens(text, index, '/*')) {
            index = afterBlock(text, index);
        } else {
            output += char;
            index += 1;
        }
    }

    return output;
}

function inStringStep(text, index) {
    const char = text[index];
    const escaped = char === '\\';

    return {
        kept: escaped ? char + (text[index + 1] ?? '') : char,
        next: index + (escaped ? 2 : 1),
        open: escaped || char !== '"',
    };
}

function opens(text, index, marker) {
    return text.startsWith(marker, index);
}

function afterLine(text, index) {
    const end = text.indexOf('\n', index);

    return end === -1 ? text.length : end;
}

function afterBlock(text, index) {
    const end = text.indexOf('*/', index + 2);

    return end === -1 ? text.length : end + 2;
}

function closesCollection(text, index) {
    if (text[index] !== ',') {
        return false;
    }

    let next = index + 1;
    while (next < text.length && text[next].trim() === '') {
        next += 1;
    }

    return text[next] === ']' || text[next] === '}';
}

function withoutTrailingCommas(text) {
    let output = '';
    let index = 0;
    let inString = false;

    while (index < text.length) {
        const char = text[index];
        const closes = closesCollection(text, index);

        if (inString) {
            const step = inStringStep(text, index);
            output += step.kept;
            inString = step.open;
            index = step.next;
        } else {
            inString = char === '"';
            output += closes ? '' : char;
            index += 1;
        }
    }

    return output;
}

// JSONC, so an ignore carries its reason beside it; two token classes do not earn a parser dependency.
function readJsonc(path) {
    const document = readFileSync(path, 'utf8');
    const json = withoutTrailingCommas(withoutComments(document));

    return JSON.parse(json);
}

const basePath = process.argv[2];
const projectPath = process.argv[3];

const base = readJsonc(basePath);

let project = {};
if (projectPath) {
    project = readJsonc(projectPath);
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

let pkg = {};
if (existsSync('package.json')) {
    pkg = JSON.parse(readFileSync('package.json', 'utf8'));
}

if (pkg.main || pkg.exports || pkg.publishConfig) {
    merged.rules = { exports: 'off', files: 'off', types: 'off', ...merged.rules };
}

// Knip resolves `ignore` globs from the root, so a member's paths carry its prefix.
const conventionIgnores = [];
const units = ['.', ...workspaceMembers('.')];

for (const unit of units) {
    const prefix = unit === '.' ? '' : `${unit}/`;

    if (existsSync(`${prefix}docs`)) {
        conventionIgnores.push(`${prefix}docs/**`);
    }

    // The preset's `entry` names the root's settings file and reaches no member's.
    if (prefix !== '' && existsSync(`${prefix}jterrazz.config.ts`)) {
        conventionIgnores.push(`${prefix}jterrazz.config.ts`);
    }

    findConventionDirs(unit, 0);
}

function findConventionDirs(dir, depth) {
    if (depth > 6) {
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
        const path = dir === '.' ? entry.name : `${dir}/${entry.name}`;
        if (GROUND.has(entry.name)) {
            conventionIgnores.push(`${path}/**`);
        } else if (!UNSCANNED.has(entry.name) && !entry.name.startsWith('.')) {
            findConventionDirs(path, depth + 1);
        }
    }
}

if (conventionIgnores.length > 0) {
    const existing = merged.ignore || [];
    merged.ignore = [...new Set([...existing, ...conventionIgnores])];
}

// knip crashes on vitest.workspace.ts, so a vitest dependency gets an explicit config.
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

if (existsSync('vitest.workspace.ts') || existsSync('vitest.workspace.js')) {
    const existing = merged.ignore || [];
    const wsFile = existsSync('vitest.workspace.ts')
        ? 'vitest.workspace.ts'
        : 'vitest.workspace.js';
    merged.ignore = [...new Set([...existing, wsFile])];
}

// Global setup/teardown are named as strings in the Playwright config, which knip cannot trace.
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

const prodDeps = Object.keys(pkg.dependencies || {});
const devDeps = Object.keys(pkg.devDependencies || {});
const peerDeps = Object.keys(pkg.peerDependencies || {});
const allDepNames = Object.keys(allDeps);
const autoIgnoreDeps = [];

// A devDependency that is also a peer is installed only to test against.
for (const dep of devDeps) {
    if (peerDeps.includes(dep)) {
        autoIgnoreDeps.push(dep);
    }
}

for (const dep of [...prodDeps, ...devDeps]) {
    // `@hono/node-server` when `hono` is installed.
    const scopeMatch = /^@(?<scope>[^/]+)\//u.exec(dep);
    if (
        scopeMatch &&
        (peerDeps.includes(scopeMatch.groups.scope) ||
            allDepNames.includes(scopeMatch.groups.scope))
    ) {
        autoIgnoreDeps.push(dep);
        continue;
    }

    // `vitepress-plugin-llms` when `vitepress` is installed.
    const pluginMatch = /^(?<parent>.+?)-(?:plugin|preset|transformer|loader)-/u.exec(dep);
    if (pluginMatch && allDepNames.includes(pluginMatch.groups.parent)) {
        autoIgnoreDeps.push(dep);
        continue;
    }

    // An eslint plugin is loaded by a config, never imported.
    if (dep.startsWith('eslint-plugin-')) {
        autoIgnoreDeps.push(dep);
    }
}

// A binary-only tool in `dependencies` is shipped for consumers to run, never imported.
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
        // Not installed locally: nothing to read.
    }
}

if (autoIgnoreDeps.length > 0) {
    const existing = merged.ignoreDependencies || [];
    merged.ignoreDependencies = [...new Set([...existing, ...autoIgnoreDeps])];
}

process.stdout.write(JSON.stringify(merged));
