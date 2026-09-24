import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { describe, expect, onTestFinished, test } from 'vitest';

import { installTsconfigPresets } from './rulebook.js';

/*
 * B9w exception, same shape as oxlint.specification.ts / oxfmt.specification.ts:
 * the product under test IS the shipped tsconfig preset, and `typescript check`
 * cannot exercise it — check loads the preset from the consumer's node_modules,
 * which a copied temp-workdir fixture does not have. So each scenario copies its
 * ground into a temp directory, installs the package there the way a consumer
 * holds it — a real directory under node_modules/@jterrazz/typescript, beside
 * an `astro` whose tsconfigs the astro preset extends — writes a tsconfig that
 * extends the preset by the name a consumer writes, and asks tsc to resolve it.
 *
 * The law: a preset's `include`/`exclude` must be scoped to the CONSUMER, never
 * to the preset file's own location. Relative globs in an extended config resolve
 * against the file that spells them (the preset), so `../../../../**` reached out
 * of the installed package and swept whatever sat next to node_modules.
 * `${configDir}` is the only form that means "the project extending me".
 *
 * The same form carries the artefact convention: the incremental buildinfo is a
 * tool's output, so it lands under the consumer's own `.artifacts/tsc/`.
 */

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

/** A consumer standing on `ground`, with the package installed and its tsconfig extending `preset`. */
function consumer(ground: string, preset: string): string {
    const created = mkdtempSync(resolve(tmpdir(), `spec-tsconfig-${preset}-`));
    onTestFinished(() => {
        rmSync(created, { force: true, recursive: true });
    });
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

/** Every tsconfig preset this package ships, by the name a consumer extends. */
const PRESETS = ['node', 'library', 'next', 'astro', 'expo', 'react'] as const;

/** Each preset, beside the fixture consumer that extends it. */
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

    /* One ground tree is held against every preset. */
    test.each(PRESETS)(
        'the %s preset leaves the ground a test stands on out of the compiled file set, wherever it sits',
        (preset) => {
            // Given - a consumer whose specs/ holds each of the four ground folders beside a contract, and whose src/ holds a module test's fixtures/
            const dir = consumer('tsconfig-ground', preset);

            // When - tsc lists the files the preset compiles
            const listed = execFileSync(TSC, ['--listFilesOnly'], { cwd: dir, encoding: 'utf8' })
                .split('\n')
                .filter((path) => path.startsWith(dir))
                .map((path) => path.slice(dir.length + 1))
                .toSorted();

            // Then - the contract and the product compile; the ground never does, under specs/ or src/
            expect(listed).toStrictEqual([
                'specs/orders/contracts/order.ts',
                'src/catalog/catalog.ts',
            ]);
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
