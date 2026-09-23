import { execFileSync } from 'node:child_process';
import {
    cpSync,
    mkdirSync,
    mkdtempSync,
    realpathSync,
    rmSync,
    symlinkSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join, resolve, sep } from 'node:path';
import { describe, expect, onTestFinished, test } from 'vitest';

/*
 * B9w exception, same shape as oxlint.specification.ts / oxfmt.specification.ts:
 * the product under test IS the shipped tsconfig preset, and `typescript check`
 * cannot exercise it — check loads the preset from the consumer's node_modules,
 * which a copied temp-workdir fixture does not have. So a consumer tsconfig that
 * extends the preset by a repo-relative path lives under fixtures/, and tsc is
 * asked to resolve it with `--showConfig` from that directory.
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

const TSC = resolve(import.meta.dirname, '../../../node_modules/.bin/tsc');

type ResolvedConfig = {
    compilerOptions: { incremental?: boolean; tsBuildInfoFile?: string };
    dir: string;
    scoped: string[];
};

function resolvedConfig(fixture: string): ResolvedConfig {
    const dir = resolve(import.meta.dirname, 'fixtures', fixture);
    const stdout = execFileSync(TSC, ['--showConfig'], { cwd: dir, encoding: 'utf8' });
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- tsc's own --showConfig output is tsc's contract
    const config = JSON.parse(stdout) as {
        compilerOptions?: ResolvedConfig['compilerOptions'];
        files?: string[];
        include?: string[];
    };

    return {
        compilerOptions: config.compilerOptions ?? {},
        dir,
        scoped: [...(config.include ?? []), ...(config.files ?? [])],
    };
}

/** Every tsconfig preset this package ships, by the name a consumer extends. */
const PRESETS = ['node', 'library', 'next', 'astro', 'expo', 'react'] as const;

describe.each(PRESETS.map((preset) => [preset, `tsconfig-${preset}`]))(
    '%s preset',
    (_preset, fixture) => {
        test('scopes the compiled file set to the consumer that extends it', () => {
            // Given - a consumer tsconfig that extends the preset and overrides nothing
            const { dir, scoped } = resolvedConfig(fixture);

            // Then - every path the preset contributes stays inside the consumer's own directory
            expect(scoped.length).toBeGreaterThan(0);
            for (const entry of scoped) {
                const absolute = isAbsolute(entry) ? entry : resolve(dir, entry);
                expect(absolute.startsWith(dir + sep)).toBe(true);
            }
        });

        test('compiles incrementally into the consumer artefacts directory', () => {
            // Given - the same consumer tsconfig
            const { compilerOptions, dir } = resolvedConfig(fixture);

            // Then - incremental compilation is on, and its buildinfo is an artefact
            expect(compilerOptions.incremental).toBe(true);
            const buildInfo = compilerOptions.tsBuildInfoFile ?? '';
            expect(resolve(dir, buildInfo)).toBe(
                resolve(dir, '.artifacts/tsc/tsconfig.tsbuildinfo'),
            );
        });
    },
);

/*
 * The ground tree is copied, and its tsconfig written at run time: one tree is
 * held against every preset, and `extends` has to name each by its path. The
 * copy links this repository's `@types`, which the node presets name.
 */
test.each(PRESETS)(
    'the %s preset leaves the ground a test stands on out of the compiled file set, wherever it sits',
    (preset) => {
        // Given - a consumer whose specs/ holds each of the four ground folders beside a contract, and whose src/ holds a module test's fixtures/
        const created = mkdtempSync(resolve(tmpdir(), `spec-tsconfig-ground-${preset}-`));
        onTestFinished(() => {
            rmSync(created, { force: true, recursive: true });
        });
        const dir = realpathSync(created);
        cpSync(resolve(import.meta.dirname, 'fixtures', 'tsconfig-ground'), dir, {
            recursive: true,
        });
        mkdirSync(join(dir, 'node_modules'));
        symlinkSync(
            resolve(import.meta.dirname, '../../../node_modules/@types'),
            join(dir, 'node_modules/@types'),
            'dir',
        );
        const extended = resolve(
            import.meta.dirname,
            '../../../src/presets/tsconfig',
            `${preset}.json`,
        );
        writeFileSync(join(dir, 'tsconfig.json'), `${JSON.stringify({ extends: extended })}\n`);

        // When - tsc lists the files the preset compiles
        const listed = execFileSync(TSC, ['--listFilesOnly'], { cwd: dir, encoding: 'utf8' })
            .split('\n')
            .filter((path) => path.startsWith(dir))
            .map((path) => path.slice(dir.length + 1))
            .toSorted();

        // Then - the contract and the product compile; the ground never does, under specs/ or src/
        expect(listed).toStrictEqual(['specs/orders/contracts/order.ts', 'src/catalog/catalog.ts']);
    },
);
