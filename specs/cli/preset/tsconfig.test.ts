import { execFileSync } from 'node:child_process';
import { isAbsolute, resolve, sep } from 'node:path';
import { describe, expect, test } from 'vitest';

/*
 * B9w exception, same shape as oxlint.specification.ts / oxfmt.specification.ts:
 * the product under test IS the shipped tsconfig preset, and `typescript check`
 * cannot exercise it — check loads the preset from the consumer's node_modules,
 * which a copied temp-workdir fixture does not have. So a consumer tsconfig that
 * extends the preset by a repo-relative path lives under _fixtures/, and tsc is
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
    const dir = resolve(import.meta.dirname, '_fixtures', fixture);
    const stdout = execFileSync(TSC, ['--showConfig'], { cwd: dir, encoding: 'utf8' });
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

describe.each([
    ['node', 'tsconfig-node'],
    ['expo', 'tsconfig-expo'],
    ['next', 'tsconfig-next'],
])('%s preset', (_preset, fixture) => {
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
});
