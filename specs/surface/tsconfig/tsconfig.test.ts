import { execFileSync, spawnSync } from 'node:child_process';
import {
    cpSync,
    mkdirSync,
    readdirSync,
    readFileSync,
    realpathSync,
    symlinkSync,
    writeFileSync,
} from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { describe, expect, test } from 'vitest';

import { GROUND_FOLDERS } from '../../../lint/kit/project/ground.js';
import { isRecord, parsedJson } from '../../__setup__/parsed-json.js';
import { installTsconfigPresets } from '../../__setup__/rulebook.js';
import { temporaryDirectory } from '../../__setup__/temporary-directory.js';

// outside: relative globs in an extended config resolve against the preset file: `${configDir}` is the only form
// that means the extending project.

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
    cpSync(resolve(import.meta.dirname, ground), dir, { recursive: true });
    installTsconfigPresets(dir);
    mkdirSync(join(dir, 'node_modules/@types'), { recursive: true });
    for (const types of readdirSync(resolve(ROOT, 'node_modules/@types'))) {
        symlinkSync(
            resolve(ROOT, 'node_modules/@types', types),
            join(dir, 'node_modules/@types', types),
            'dir',
        );
    }
    // outside: the checkout installs no Bun, so the bun preset's `types` find a one-line stand-in for @types/bun.
    symlinkSync(
        resolve(import.meta.dirname, '../../__fixtures__/bun-types'),
        join(dir, 'node_modules/@types/bun'),
        'dir',
    );
    writeFileSync(
        join(dir, 'tsconfig.json'),
        `${JSON.stringify({ extends: `@jterrazz/typescript/tsconfig/${preset}` })}\n`,
    );
    return dir;
}

function resolvedConfig(dir: string): ResolvedConfig {
    const stdout = execFileSync(TSC, ['--showConfig'], { cwd: dir, encoding: 'utf8' });
    const config = parsedJson(
        stdout,
        (
            value,
        ): value is {
            compilerOptions?: ResolvedConfig['compilerOptions'];
            exclude?: string[];
            files?: string[];
            include?: string[];
        } => isRecord(value),
    );

    return {
        compilerOptions: config.compilerOptions ?? {},
        dir,
        exclude: config.exclude ?? [],
        scoped: [...(config.include ?? []), ...(config.files ?? [])],
    };
}

function hermesErrorsUnder(preset: string): string {
    return spawnSync(TSC, ['--noEmit', '--pretty', 'false'], {
        cwd: consumer('./__fixtures__/tsconfig-hermes', preset),
        encoding: 'utf8',
    }).stdout;
}

const PRESETS = ['node', 'bun', 'next', 'astro', 'expo', 'react'] as const;

const FIXTURES = PRESETS.map((preset) => [preset, `./__fixtures__/tsconfig-${preset}`] as const);

describe('tsconfig', () => {
    test.each(FIXTURES)(
        'the %s preset scopes the compiled file set to the consumer that extends it',
        (preset, fixture) => {
            // Given - a consumer tsconfig that extends the preset and overrides nothing
            const { dir, scoped } = resolvedConfig(consumer(fixture, preset));

            // Then - every path the preset contributes stays inside the consumer's own directory
            expect(scoped.length).toBeGreaterThan(0);
            expect(
                scoped.filter(
                    (entry) =>
                        !(isAbsolute(entry) ? entry : resolve(dir, entry)).startsWith(dir + sep),
                ),
            ).toStrictEqual([]);
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
            // Given - a consumer whose specs/ holds each of the four ground folders beside a `__setup__/` module, and whose src/ holds a module test's __fixtures__/ in its __tests__/
            const dir = consumer('./__fixtures__/tsconfig-ground', preset);

            // When - tsc lists the files the preset compiles
            const listed = execFileSync(TSC, ['--listFilesOnly'], { cwd: dir, encoding: 'utf8' })
                .split('\n')
                .filter((path) => path.startsWith(dir))
                .map((path) => path.slice(dir.length + 1))
                .toSorted();

            // Then - the `__setup__/` module and the product compile; the ground never does, under specs/ or src/
            expect(listed).toStrictEqual([
                'specs/orders/__setup__/order.ts',
                'src/catalog/catalog.ts',
            ]);
        },
    );

    test.each(PRESETS)(
        'the %s preset leaves out the ground folders the kit lists, as JSON keeps them literal',
        (preset) => {
            // Given - the preset as it ships
            const shipped = parsedJson(
                readFileSync(resolve(ROOT, `src/presets/tsconfig/${preset}.json`), 'utf8'),
                (value): value is { exclude?: string[] } => isRecord(value),
            );

            // Then - its ground entries are the kit's list, in its order
            expect(
                (shipped.exclude ?? []).filter((entry) => entry.startsWith(`\${configDir}/**/`)),
            ).toStrictEqual(GROUND_FOLDERS.map((folder) => `\${configDir}/**/${folder}`));
        },
    );

    test('the astro preset extends Astro strict, and its own ground and JSX runtime win', () => {
        // Given - an Astro consumer that writes the one extends the chapter documents
        const { compilerOptions, dir, exclude } = resolvedConfig(
            consumer('./__fixtures__/tsconfig-astro', 'astro'),
        );

        // Then - Astro's settings arrive underneath, and ours are the ones that hold
        expect(compilerOptions.allowImportingTsExtensions).toBe(true);
        expect(compilerOptions.jsx).toBe('react-jsx');
        expect(exclude.map((entry) => relative(dir, entry))).toStrictEqual(
            expect.arrayContaining([
                'node_modules',
                'dist',
                '.artifacts',
                ...GROUND_FOLDERS.map((folder) => `**/${folder}`),
            ]),
        );
    });

    test('the expo preset refuses what Hermes does not implement, which the node preset compiles', () => {
        // Given - one module sorting a copy with `toSorted`, under the expo preset and under node's

        // Then - the expo app's type check names the call, the node project's passes
        expect([
            hermesErrorsUnder('expo').includes("Property 'toSorted' does not exist"),
            hermesErrorsUnder('node'),
        ]).toStrictEqual([true, '']);
    });
});
