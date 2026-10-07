import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, test } from 'vitest';

import {
    BROWSER_PLATFORMS,
    buildPlanOf,
    conventionsOf,
    planOf,
    unsourcedOf,
} from '../build-plan.js';
import type { Resolution } from '../preset.js';
import { PLATFORMS } from '../project-kind.js';

function tree(files: readonly string[], manifest?: object): string {
    const root = mkdtempSync(join(tmpdir(), 'build-plan-'));
    for (const file of files) {
        mkdirSync(dirname(join(root, file)), { recursive: true });
        writeFileSync(join(root, file), '');
    }
    if (manifest !== undefined) {
        writeFileSync(join(root, 'package.json'), JSON.stringify(manifest));
    }

    return root;
}

const resolution = (problem: null | string, declared = true): Resolution => ({
    problem,
    resolved: {
        baseline: [],
        declaration: declared ? { kind: 'api', platform: 'node' } : null,
        laws: [],
        layers: [],
        names: [],
        optOuts: [],
        own: {},
        presets: [],
        sections: {},
    },
});

describe('build-plan', () => {
    test('conventionsOf — builds each module named for how it is loaded, and the repository’s own commands and self entries apart', () => {
        // Given - the three shipped names, two commands, the root modules of lint/self/, files that are no module, and the same names where none is read
        const root = tree([
            'src/instrumentation.ts',
            'src/pool/xlsx.worker.ts',
            'src/runs/temp-root.global-setup.ts',
            'src/runs/temp-root.global-setup.test.ts',
            'src/tools/schema.cli.ts',
            'src/__fixtures__/stray.worker.ts',
            'src/.cache/stray.global-setup.ts',
            'src/node_modules/stray.worker.ts',
            'src/pool/xlsx.worker.ts.orig',
            'src/legacy-instrumentation.ts',
            'src/index.ts',
            'lint/self/self.cli.ts',
            'lint/self/preset.ts',
            'lint/self/preset.test.ts',
            'lint/self/rules/plugin.ts',
            'lint/self/notes.md',
            'src/tools/schema.json',
            'lint/consumer/rules/rule.ts',
            'specs/cli/__setup__/selection.cli.ts',
        ]);

        // Then - the shipped entries under their own names, the repository's under their stems
        expect(conventionsOf(root)).toStrictEqual({
            problem: null,
            settings: {
                dev: {
                    preset: 'lint/self/preset.ts',
                    schema: 'src/tools/schema.cli.ts',
                    self: 'lint/self/self.cli.ts',
                },
                entries: {
                    instrumentation: 'src/instrumentation.ts',
                    'temp-root.global-setup': 'src/runs/temp-root.global-setup.ts',
                    'xlsx.worker': 'src/pool/xlsx.worker.ts',
                },
            },
        });
    });

    test('conventionsOf — refuses two modules built to one name, shipped or not, and reads a tree with no src/ as building nothing', () => {
        // Given - two workers of one name, two commands of one stem, and an empty tree
        const shipped = tree(['src/a/pool.worker.ts', 'src/b/pool.worker.ts']);
        const dev = tree(['src/a/seed.cli.ts', 'lint/self/seed.ts']);
        const empty = tree([]);

        // Then - each collision named with its two sources, nothing built from it
        expect([conventionsOf(shipped), conventionsOf(dev), conventionsOf(empty)]).toStrictEqual([
            {
                problem:
                    'holds two modules built as `dist/pool.worker.js`: src/a/pool.worker.ts and src/b/pool.worker.ts — rename one',
                settings: { dev: {}, entries: {} },
            },
            {
                problem:
                    'holds two modules built as `.artifacts/dev/seed.js`: src/a/seed.cli.ts and lint/self/seed.ts — rename one',
                settings: { dev: {}, entries: {} },
            },
            { problem: null, settings: { dev: {}, entries: {} } },
        ]);
    });

    test('the browser platforms — every platform whose code runs in a browser or a device builds for the browser, the others for node', () => {
        // Given - every platform a project declares
        // Then - the ones a bundler ships to a browser or a device are the browser's
        expect(PLATFORMS.filter((platform) => BROWSER_PLATFORMS.has(platform))).toStrictEqual([
            'react',
            'next',
            'astro',
            'expo',
            'browser',
        ]);
    });

    test('unsourcedOf — names each published code target whose entry is on no disk, and neither a declaration, a pattern nor a target outside dist/', () => {
        // Given - a library publishing its index, a subpath whose module is off the entry grammar, a CommonJS one with none, a bin with no command module, declarations — one named like JSON —, an `.mjs` the build does not write, a pattern and a target beside dist/
        const root = tree(['src/index.ts', 'src/register.ts'], {
            bin: { greet: './dist/greet.js' },
            exports: {
                '.': { import: './dist/index.js', types: './dist/index.d.ts' },
                './data': { types: './dist/data.json.d.ts' },
                './legacy': './dist/legacy.cjs',
                './module': './dist/module.mjs',
                './register': './dist/register.js',
                './tsconfig/*': './dist/tsconfig/*.js',
                './raw': './raw/raw.js',
            },
            name: '@scope/kit',
        });

        // Then - the two subpaths and the bin, each with the two places its entry may sit
        expect(unsourcedOf(root)).toStrictEqual([
            '`./legacy` publishes dist/legacy.cjs, but neither src/index.legacy.ts nor lint/index.legacy.ts exists',
            '`./register` publishes dist/register.js, but neither src/index.register.ts nor lint/index.register.ts exists',
            'the bin `greet` publishes dist/greet.js, but neither src/greet.bin.ts nor lint/greet.bin.ts exists',
        ]);
    });

    test('buildPlanOf — a mobile app builds nothing a package build compiles, only the repository’s own commands', () => {
        // Given - an expo app whose main names the router's entry, with one command of its own, and the same app without it
        const manifest = { main: 'expo-router/entry', name: 'app' };
        const scripted = tree(['app/index.tsx', 'src/tools/seed.cli.ts'], manifest);
        const bare = tree(['app/index.tsx'], manifest);
        const declaration = { kind: 'mobile' as const, platform: 'expo' as const };

        // Then - the command alone, built for node into the repository's own folder, and nothing at all
        expect([
            buildPlanOf(scripted, { declaration, settings: conventionsOf(scripted).settings }),
            buildPlanOf(bare, { declaration, settings: conventionsOf(bare).settings }),
        ]).toStrictEqual([
            [
                {
                    clean: true,
                    dts: true,
                    entry: { seed: 'src/tools/seed.cli.ts' },
                    fixedExtension: false,
                    format: ['esm'],
                    hash: false,
                    outDir: '.artifacts/dev',
                    outputOptions: { chunkFileNames: 'shared-[name].js' },
                    platform: 'node',
                    sourcemap: true,
                },
            ],
            [],
        ]);
    });

    test('buildPlanOf — a package loaded by require builds both formats, cleaning dist/ first, for node when it declares no platform', () => {
        // Given - a kind-less suite whose manifest publishes its index as ESM and CommonJS
        const root = tree(['src/index.ts'], {
            exports: { import: './dist/index.js', require: './dist/index.cjs' },
            name: 'dual',
        });
        const declaration = { kind: null, platform: null };

        // Then - one step, both formats, the CommonJS exports named
        expect(
            buildPlanOf(root, { declaration, settings: conventionsOf(root).settings }),
        ).toStrictEqual([
            {
                clean: true,
                dts: true,
                entry: { index: 'src/index.ts' },
                fixedExtension: false,
                format: ['esm', 'cjs'],
                hash: false,
                outDir: 'dist',
                outputOptions: { chunkFileNames: 'shared-[name].js', exports: 'named' },
                platform: 'node',
                sourcemap: true,
            },
        ]);
    });

    test('buildPlanOf — an application that publishes nothing and keeps no src/index.ts builds the modules named for how they are loaded, and no index', () => {
        // Given - a worker alone
        const root = tree(['src/pool/xlsx.worker.ts']);

        // Then - the worker's step, cleaning dist/
        expect(
            buildPlanOf(root, {
                declaration: { kind: 'api', platform: 'node' },
                settings: conventionsOf(root).settings,
            }),
        ).toStrictEqual([
            {
                clean: true,
                dts: true,
                entry: { 'xlsx.worker': 'src/pool/xlsx.worker.ts' },
                fixedExtension: false,
                format: ['esm'],
                hash: false,
                outDir: 'dist',
                outputOptions: { chunkFileNames: 'shared-[name].js' },
                platform: 'node',
                sourcemap: true,
            },
        ]);
    });

    test('buildPlanOf — a browser condition is built apart, for the browser and with no declarations, after the unit’s own platform', () => {
        // Given - a library on react whose index has a browser build beside its default
        const root = tree(['src/index.ts', 'src/index.browser.ts'], {
            exports: { '.': { browser: './dist/index.browser.js', default: './dist/index.js' } },
            name: 'kit',
        });
        const declaration = { kind: 'library' as const, platform: 'react' as const };
        const step = { fixedExtension: false, format: ['esm'], hash: false, outDir: 'dist' };
        const shared = { chunkFileNames: 'shared-[name].js' };

        // Then - the default for the browser, react being a browser platform, cleaning dist/; the browser build after it, keeping what the first wrote
        expect(
            buildPlanOf(root, { declaration, settings: conventionsOf(root).settings }),
        ).toStrictEqual([
            {
                ...step,
                clean: true,
                dts: true,
                entry: { index: 'src/index.ts' },
                outputOptions: shared,
                platform: 'browser',
                sourcemap: true,
            },
            {
                ...step,
                clean: false,
                dts: false,
                entry: { 'index.browser': 'src/index.browser.ts' },
                outputOptions: shared,
                platform: 'browser',
                sourcemap: true,
            },
        ]);
    });

    test('planOf — refuses a declaration that does not read and two modules built to one name before anything else, then every unsourced target in one line, and plans the rest', () => {
        // Given - a settings file that does not resolve, two workers of one name, a manifest whose two targets have no entry, and a clean application
        const unsourced = tree([], { bin: { a: './dist/a.js', b: './dist/b.js' }, name: 'two' });
        const clean = tree(['src/index.ts']);

        // Then - each refusal in four parts, and the application's one step
        expect([
            planOf(clean, resolution('declares the kind `nope`', false)),
            planOf(tree(['src/a/pool.worker.ts', 'src/b/pool.worker.ts']), resolution(null)),
            planOf(unsourced, resolution(null)),
            planOf(clean, resolution('is ignored once a declaration reads')),
        ]).toStrictEqual([
            'found: jterrazz.config.ts declares the kind `nope` · why: every law a project is held to is resolved from that file, and a file that cannot be resolved judges nothing · fix: correct jterrazz.config.ts until it loads and each preset and section has its declared shape, then run again · read: docs/reference/building.md#the-entries',
            'found: jterrazz.config.ts holds two modules built as `dist/pool.worker.js`: src/a/pool.worker.ts and src/b/pool.worker.ts — rename one · why: every law a project is held to is resolved from that file, and a file that cannot be resolved judges nothing · fix: correct jterrazz.config.ts until it loads and each preset and section has its declared shape, then run again · read: docs/reference/building.md#the-entries',
            'found: the bin `a` publishes dist/a.js, but neither src/a.bin.ts nor lint/a.bin.ts exists; the bin `b` publishes dist/b.js, but neither src/b.bin.ts nor lint/b.bin.ts exists · why: a build that skips a published target ships a package whose import of it resolves to nothing · fix: name each entry by the entry grammar — `./register` is built from src/index.register.ts — or drop the target from package.json · read: docs/reference/building.md#the-entries',
            [
                {
                    clean: true,
                    dts: true,
                    entry: { index: 'src/index.ts' },
                    fixedExtension: false,
                    format: ['esm'],
                    hash: false,
                    outDir: 'dist',
                    outputOptions: { chunkFileNames: 'shared-[name].js' },
                    platform: 'node',
                    sourcemap: true,
                },
            ],
        ]);
    });
});
