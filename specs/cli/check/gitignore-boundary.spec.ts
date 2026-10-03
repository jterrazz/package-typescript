import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { onlyPasses, SELECTING_BIN } from '../_setup/check-passes.js';
import { temporaryDirectory } from '../_setup/temporary-directory.js';

// outside: `.git` is the one path a fixture cannot carry: git does not track it.

const ANCESTOR_COMPLAINT = '.gitignore names coverage/';

function checkFromClone(boundary: 'directory' | 'file' | 'none'): {
    status: null | number;
    stdout: string;
} {
    const workDir = temporaryDirectory('spec-gitignore-boundary-');
    cpSync(resolve(import.meta.dirname, '_fixtures/gitignore/repository-boundary'), workDir, {
        recursive: true,
    });

    const clone = join(workDir, 'clone');
    if (boundary === 'directory') {
        spawnSync('git', ['init', '--quiet'], { cwd: clone });
    }
    if (boundary === 'file') {
        mkdirSync(join(workDir, 'bare.git'));
        writeFileSync(join(clone, '.git'), `gitdir: ${join(workDir, 'bare.git')}\n`);
    }

    const result = spawnSync('node', [SELECTING_BIN, 'check'], {
        cwd: clone,
        encoding: 'utf8',
        env: { ...process.env, ...onlyPasses('gitignore') },
    });

    return { status: result.status, stdout: result.stdout };
}

describe('gitignore-boundary', () => {
    test("reads the parent's .gitignore when nothing marks a boundary", () => {
        // Given - a project nested in a workspace root whose .gitignore names an artefact
        // When - the nested project runs its own quality checks
        const { status, stdout } = checkFromClone('none');

        // Then - the ancestor is the second file the gate reads, and it fails on it
        expect(status).toBe(1);
        expect(stdout).toContain(ANCESTOR_COMPLAINT);
    });

    test('stops at a .git DIRECTORY — a clone inside another repository', () => {
        // Given - the same tree, with the nested project made a clone of its own
        // When - the clone runs its own quality checks
        const { stdout } = checkFromClone('directory');

        // Then - the walk never reaches the tree above, so neither complaint is the clone's
        expect(stdout).toContain('Gitignore (artefacts)');
        expect(stdout).not.toContain(ANCESTOR_COMPLAINT);
        expect(stdout).not.toContain('does not ignore .artifacts/');
    });

    test('stops at a .git FILE — a worktree inside another repository', () => {
        // Given - the same tree, with the nested project made a worktree
        // When - the worktree runs its own quality checks
        const { stdout } = checkFromClone('file');

        // Then - a `.git` file marks the boundary exactly as a directory does
        expect(stdout).toContain('Gitignore (artefacts)');
        expect(stdout).not.toContain(ANCESTOR_COMPLAINT);
        expect(stdout).not.toContain('does not ignore .artifacts/');
    });
});
