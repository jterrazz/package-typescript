import { describe, expect, test } from 'vitest';

import { cli } from '../cli.specification.js';

/*
 * Routed through the product command: `typescript check` merges the base knip
 * preset with any project-local knip.json and runs knip as one of its four tools.
 * grep is the scalpel — knip's "Unused" report language and the offending
 * dependency name are probed in the combined output.
 */

describe('config merging', () => {
    test('passes with no local knip.json when the base config covers dependencies', async () => {
        // Given - a project with ecosystem deps but no knip.json
        const result = await cli.fixture('knip/no-config/').exec('check');

        // Then - knip reports nothing unused (the base config ignores ecosystem deps)
        expect(result.stdout).toContain('Knip (unused code)');
        expect(result.stdout).not.toContain('Unused');
    });

    test('merges project ignoreDependencies with the base config', async () => {
        // Given - a project that ignores some-local-dep plus base-ignored deps
        const result = await cli.fixture('knip/with-overrides/').exec('check');

        // Then - knip stays silent: both base and project ignored deps are respected
        expect(result.stdout).not.toContain('some-local-dep');
        expect(result.stdout).not.toContain('Unused');
    });

    test('concatenates arrays from the base and project configs', async () => {
        // Given - a project with deps covered by both base and local ignore lists
        const result = await cli.fixture('knip/merge-arrays/').exec('check');

        // Then - knip stays silent: ignored deps from both configs are merged
        expect(result.stdout).not.toContain('extra-dep');
        expect(result.stdout).not.toContain('Unused');
    });

    test('still detects genuinely unused dependencies', async () => {
        // Given - a project with a dependency ignored by neither config
        const result = await cli.fixture('knip/unused-dep/').exec('check');

        // Then - knip reports the unused dependency
        expect(result.stdout).toContain('totally-unused-pkg');
    });
});

describe('dynamic detection', () => {
    test('disables export rules for published libraries', async () => {
        // Given - a library with a main field and unused exports
        const result = await cli.fixture('knip/library-exports/').exec('check');

        // Then - knip stays silent because export/type/file rules are auto-disabled
        expect(result.stdout).toContain('Knip (unused code)');
        expect(result.stdout).not.toContain('Unused');
    });

    test('auto-ignores plugin and scoped addon devDependencies', async () => {
        // Given - a project with vitepress plugin devDeps
        const result = await cli.fixture('knip/plugin-deps/').exec('check');

        // Then - knip stays silent: plugin deps are auto-ignored
        expect(result.stdout).not.toContain('vitepress');
        expect(result.stdout).not.toContain('Unused');
    });
});
