import { describe, expect, test } from 'vitest';

import { knipSpec, PACKAGE_ROOT } from '../../../setup/knip.specification.js';

describe('knip config merging', () => {
    test('passes with no local knip.json when base config covers dependencies', async () => {
        // Given — a project with @jterrazz/test and @jterrazz/codestyle but no knip.json
        const result = await knipSpec('no local config')
            .project('no-config')
            .exec(PACKAGE_ROOT)
            .run();

        // Then — knip passes because base config ignores ecosystem deps
        expect(result.exitCode).toBe(0);
    });

    test('merges project ignoreDependencies with base config', async () => {
        // Given — a project that ignores some-local-dep plus base-ignored deps
        const result = await knipSpec('project overrides')
            .project('with-overrides')
            .exec(PACKAGE_ROOT)
            .run();

        // Then — knip passes: both base and project ignored deps are respected
        expect(result.exitCode).toBe(0);
    });

    test('concatenates arrays from base and project configs', async () => {
        // Given — a project with deps covered by both base and local ignore lists
        const result = await knipSpec('merged arrays')
            .project('merge-arrays')
            .exec(PACKAGE_ROOT)
            .run();

        // Then — knip passes: all ignored deps from both configs are merged
        expect(result.exitCode).toBe(0);
    });

    test('still detects genuinely unused dependencies', async () => {
        // Given — a project with a dependency not ignored by either config
        const result = await knipSpec('unused dep detected')
            .project('unused-dep')
            .exec(PACKAGE_ROOT)
            .run();

        // Then — knip reports the unused dependency
        expect(result.exitCode).not.toBe(0);
        expect(result.stdout).toContain('totally-unused-pkg');
    });
});

describe('knip dynamic detection', () => {
    test('disables export rules for published libraries', async () => {
        // Given — a library with main field and unused exports
        const result = await knipSpec('library exports')
            .project('library-exports')
            .exec(PACKAGE_ROOT)
            .run();

        // Then — knip passes because exports/types/files rules are auto-disabled
        expect(result.exitCode).toBe(0);
    });

    test('auto-ignores plugin and scoped addon devDependencies', async () => {
        // Given — a project with vitepress-plugin-* and @vitepress/* devDeps
        const result = await knipSpec('plugin deps')
            .project('plugin-deps')
            .exec(PACKAGE_ROOT)
            .run();

        // Then — knip passes: plugin deps are auto-ignored
        expect(result.exitCode).toBe(0);
    });
});
