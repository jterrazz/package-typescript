import { execFileSync } from 'node:child_process';
import { cpSync, realpathSync, symlinkSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { describe, expect, test } from 'vitest';

import { temporaryDirectory } from '../temporary-directory.js';
import { installTsconfigPresets } from './rulebook.js';

// Relative globs in an extended config resolve against the preset file, so `../../../../**` once swept
// whatever sat next to node_modules: `${configDir}` is the only form that means "the project extending me".

const ROOT = resolve(import.meta.dirname, '../../..');
const TSC = resolve(ROOT, 'node_modules/.bin/tsc');

type ResolvedConfig = {
    compilerOptions: {
        allowImportingTsExtensions?: boolean;
        incremental?: boolean;
        jsx?: string;
        tsBuildInfoFile?: string;
    };
    dir: string;
    exclude: string[];
    scoped: string[];
};

function consumer(ground: string, preset: string): string {
    const created = temporaryDirectory(`spec-tsconfig-${preset}-`);
    const dir = realpathSync(created);
    cpSync(resolve(import.meta.dirname, 'fixtures', ground), dir, { recursive: true });
    installTsconfigPresets(dir);
    symlinkSync(resolve(ROOT, 'node_modules/@types'), join(dir, 'node_modules/@types'), 'dir');
    writeFileSync(
        join(dir, 'tsconfig.json'),
        `${JSON.stringify({ extends: `@jterrazz/typescript/tsconfig/${preset}` })}\n`,
    );
    return dir;
}

function resolvedConfig(dir: string): ResolvedConfig {
    const stdout = execFileSync(TSC, ['--showConfig'], { cwd: dir, encoding: 'utf8' });
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- tsc's own --showConfig output is tsc's contract
    const config = JSON.parse(stdout) as {
        compilerOptions?: ResolvedConfig['compilerOptions'];
        exclude?: string[];
        files?: string[];
        include?: string[];
    };

    return {
        compilerOptions: config.compilerOptions ?? {},
        dir,
        exclude: config.exclude ?? [],
        scoped: [...(config.include ?? []), ...(config.files ?? [])],
    };
}

const PRESETS = ['node', 'library', 'next', 'astro', 'expo', 'react'] as const;

const FIXTURES = PRESETS.map((preset) => [preset, `tsconfig-${preset}`] as const);

describe('tsconfig', () => {
    test.each(FIXTURES)(
        'the %s preset scopes the compiled file set to the consumer that extends it',
        (preset, fixture) => {
            // Given - a consumer tsconfig that extends the preset and overrides nothing
            const { dir, scoped } = resolvedConfig(consumer(fixture, preset));

            // Then - every path the preset contributes stays inside the consumer's own directory
            expect(scoped.length).toBeGreaterThan(0);
            for (const entry of scoped) {
                const absolute = isAbsolute(entry) ? entry : resolve(dir, entry);
                expect(absolute.startsWith(dir + sep)).toBe(true);
            }
        },
    );

    test.each(FIXTURES)(
        'the %s preset compiles incrementally into the consumer artefacts directory',
        (preset, fixture) => {
            // Given - the same consumer tsconfig
            const { compilerOptions, dir } = resolvedConfig(consumer(fixture, preset));

            // Then - incremental compilation is on, and its buildinfo is an artefact
            expect(compilerOptions.incremental).toBe(true);
            const buildInfo = compilerOptions.tsBuildInfoFile ?? '';
            expect(resolve(dir, buildInfo)).toBe(
                resolve(dir, '.artifacts/tsc/tsconfig.tsbuildinfo'),
            );
        },
    );

    test.each(PRESETS)(
        'the %s preset leaves the ground a test stands on out of the compiled file set, wherever it sits',
        (preset) => {
            // Given - a consumer whose specs/ holds each of the four ground folders beside a stub, and whose src/ holds a module test's fixtures/
            const dir = consumer('tsconfig-ground', preset);

            // When - tsc lists the files the preset compiles
            const listed = execFileSync(TSC, ['--listFilesOnly'], { cwd: dir, encoding: 'utf8' })
                .split('\n')
                .filter((path) => path.startsWith(dir))
                .map((path) => path.slice(dir.length + 1))
                .toSorted();

            // Then - the stub and the product compile; the ground never does, under specs/ or src/
            expect(listed).toStrictEqual(['specs/orders/stubs/order.ts', 'src/catalog/catalog.ts']);
        },
    );

    test('the astro preset extends Astro strict, and its own ground and JSX runtime win', () => {
        // Given - an Astro consumer that writes the one extends the chapter documents
        const { compilerOptions, dir, exclude } = resolvedConfig(
            consumer('tsconfig-astro', 'astro'),
        );

        // Then - Astro's settings arrive underneath, and ours are the ones that hold
        expect(compilerOptions.allowImportingTsExtensions).toBe(true);
        expect(compilerOptions.jsx).toBe('react-jsx');
        expect(exclude.map((entry) => relative(dir, entry))).toStrictEqual(
            expect.arrayContaining([
                'node_modules',
                'dist',
                '.artifacts',
                '**/fixtures',
                '**/expected',
                '**/seeds',
                '**/requests',
            ]),
        );
    });
});
