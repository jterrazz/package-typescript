import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { onlyPasses } from '../__setup__/check-passes.js';
import { cli } from '../cli.specification.js';

describe('default-config', () => {
    test('hands a project with no config of its own the default, never the config above it', async () => {
        // Given - a project with no oxlint or oxfmt config, under a folder whose configs turn `no-debugger` off and indent with tabs
        // When - the quality checks run from the project, oxlint answering in its compact form
        const result = await cli
            .with({ env: onlyPasses('oxlint', 'oxfmt') })
            .fixture(directory('./__fixtures__/default-config/decoy-parent/'))
            .exec('check', { cwd: 'project' });

        // Then - the default profile reports the debugger, and the default formatter passes the four-space source and ignores public/
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toMatch(`
             START  Running quality checks

             RUN  Oxlint Check

            src/index.ts:2:5: error eslint(no-debugger): \`debugger\` statement is not allowed help: Remove the debugger statement
            ✗ Failed with exit code 1 ({{duration}})

             RUN  Oxfmt Check

            ✓ Passed ({{duration}})

             END  Finalizing quality checks

            ✗ Some checks failed, first Oxlint Check: src/index.ts:2:5: error eslint(no-debugger): \`debugger\` statement is not allowed help: Remove the debugger statement
        `);
    });

    test('leaves a project with a config of its own to it, and to the nested config beneath it', async () => {
        // Given - a project whose root config arms `eqeqeq` alone, and a nested config turning it off in src/legacy/
        // When - the quality checks run
        const result = await cli
            .with({ env: onlyPasses('oxlint') })
            .fixture(directory('./__fixtures__/default-config/own-nested/'))
            .exec('check');

        // Then - the root `==` is reported, the nested one is not, and no rule of the default profile speaks
        const stdout = result.stdout.text;
        expect(stdout).toContain('eslint(eqeqeq)');
        expect(stdout).not.toContain('src/legacy/');
        expect(stdout).not.toContain('no-debugger');
    });
});
