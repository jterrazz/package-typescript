import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';

/*
 * A chain, not a document — and the product command all the same. What no
 * document can state here is the GROUND: a member run from inside a workspace,
 * with an ancestor `.gitignore` the format has no way to place ABOVE the working
 * directory `fixture:` spreads into. So the ground is built here, and the
 * product binary runs cwd'd into the member — the one thing the literate `run`
 * schema cannot express (`command` runs through the shell at the working
 * directory alone; there is no per-run `cwd`).
 */

const BIN = resolve(import.meta.dirname, '../../../bin/typescript.sh');

let workDir = '';

afterEach(() => {
    if (workDir) {
        rmSync(workDir, { force: true, recursive: true });
        workDir = '';
    }
});

function checkFromMember(fixture: string): { status: null | number; stdout: string } {
    workDir = mkdtempSync(resolve(tmpdir(), 'spec-gitignore-workspace-'));
    cpSync(resolve(import.meta.dirname, '_fixtures/gitignore', fixture), workDir, {
        recursive: true,
    });

    const result = spawnSync('bash', [BIN, 'check'], {
        cwd: resolve(workDir, 'packages/foo'),
        encoding: 'utf8',
    });

    return { status: result.status, stdout: result.stdout };
}

describe('the gitignore gate in a workspace', () => {
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
        expect(stdout).toContain('.gitignore names coverage/ — its home is .artifacts/coverage/');
        expect(stdout).not.toContain('does not ignore .artifacts/');
    });
});
