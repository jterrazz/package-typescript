import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { onlyPasses } from '../__setup__/check-passes.js';
import { cli } from '../cli.specification.js';

const gitignore = cli.with({ env: onlyPasses('gitignore') });

describe('gitignore-workspace', () => {
    test('passes a member with no .gitignore of its own when the root ignores .artifacts/', async () => {
        // Given - a workspace root that holds the convention, a member with none of its own
        // When - the member runs its own quality checks
        const result = await gitignore
            .fixture(directory('./__fixtures__/gitignore/workspace-root-covers/'))
            .exec('check', { cwd: 'packages/foo' });

        // Then - the ancestor covers it, and the run is green
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(`
             START  Running quality checks

             RUN  Gitignore (artefacts)

            ✓ Passed ({{duration}})

             END  Finalizing quality checks

            ✓ All checks passed
        `);
    });

    test('fails a member when neither its own nor the root .gitignore ignores .artifacts/', async () => {
        // Given - a workspace root with a `.gitignore` that never reached the convention
        // When - the member runs its own quality checks
        const result = await gitignore
            .fixture(directory('./__fixtures__/gitignore/workspace-root-missing/'))
            .exec('check', { cwd: 'packages/foo' });

        // Then - the gate names the ROOT file, two directories up from the member
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toMatch(`
             START  Running quality checks

             RUN  Gitignore (artefacts)

            Artefacts belong under .artifacts/<tool>/ at the project root:
              ✗ ../../.gitignore does not ignore .artifacts/ — add it
            Run 'typescript fix' to rewrite .gitignore.
            ✗ Failed with exit code 1 ({{duration}})

             END  Finalizing quality checks

            ✗ Some checks failed — first Gitignore (artefacts): Artefacts belong under .artifacts/<tool>/ at the project root:
        `);
    });

    test('fails a member whose OWN .gitignore names an artefact, even though the root covers the convention', async () => {
        // Given - a root that already ignores .artifacts/, and a member with a stray old-layout line
        // When - the member runs its own quality checks
        const result = await gitignore
            .fixture(directory('./__fixtures__/gitignore/workspace-member-stray/'))
            .exec('check', { cwd: 'packages/foo' });

        // Then - the member's own line is named, and the root is never asked to change
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toMatch(`
             START  Running quality checks

             RUN  Gitignore (artefacts)

            Artefacts belong under .artifacts/<tool>/ at the project root:
              ✗ .gitignore names coverage/ — its home is .artifacts/vitest/coverage/
            Run 'typescript fix' to rewrite .gitignore.
            ✗ Failed with exit code 1 ({{duration}})

             END  Finalizing quality checks

            ✗ Some checks failed — first Gitignore (artefacts): Artefacts belong under .artifacts/<tool>/ at the project root:
        `);
    });
});
