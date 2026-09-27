import { spawnSync } from 'node:child_process';
import { cpSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { onlyPasses, SELECTING_BIN } from '../_setup/check-passes.js';
import { temporaryDirectory } from '../_setup/temporary-directory.js';

// A document's `run` has no per-run `cwd`, and `fixture:` cannot place an ancestor `.gitignore` above the working directory.

function checkFromMember(fixture: string): { status: null | number; stdout: string } {
    const workDir = temporaryDirectory('spec-gitignore-workspace-');
    cpSync(resolve(import.meta.dirname, '_fixtures/gitignore', fixture), workDir, {
        recursive: true,
    });

    const result = spawnSync('node', [SELECTING_BIN, 'check'], {
        cwd: resolve(workDir, 'packages/foo'),
        encoding: 'utf8',
        env: { ...process.env, ...onlyPasses('gitignore') },
    });

    return { status: result.status, stdout: result.stdout };
}

describe('gitignore-workspace', () => {
    test('passes a member with no .gitignore of its own when the root ignores .artifacts/', () => {
        // Given - a workspace root that holds the convention, a member with none of its own
        // When - the member runs its own quality checks
        const { status, stdout } = checkFromMember('workspace-root-covers');

        // Then - the ancestor covers it, and the whole run is green
        expect(status).toBe(0);
        expect(stdout).toContain('Gitignore (artefacts)');
        expect(stdout).toContain('All checks passed');
    });

    test('fails a member when neither its own nor the root .gitignore ignores .artifacts/', () => {
        // Given - a workspace root with a `.gitignore` that never reached the convention
        // When - the member runs its own quality checks
        const { status, stdout } = checkFromMember('workspace-root-missing');

        // Then - the gate names the ROOT file, two directories up from the member
        expect(status).toBe(1);
        expect(stdout).toContain('Artefacts belong under .artifacts/<tool>/ at the project root:');
        expect(stdout).toContain('../../.gitignore does not ignore .artifacts/ — add it');
    });

    test('fails a member whose OWN .gitignore names an artefact, even though the root covers the convention', () => {
        // Given - a root that already ignores .artifacts/, and a member with a stray old-layout line
        // When - the member runs its own quality checks
        const { status, stdout } = checkFromMember('workspace-member-stray');

        // Then - the gate names the MEMBER's own file, and never repeats the "not ignored" error
        expect(status).toBe(1);
        expect(stdout).toContain(
            '.gitignore names coverage/ — its home is .artifacts/vitest/coverage/',
        );
        expect(stdout).not.toContain('does not ignore .artifacts/');
    });
});
