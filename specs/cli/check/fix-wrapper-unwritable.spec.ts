import { spawnSync } from 'node:child_process';
import { chmodSync, cpSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import { describe, expect, onTestFinished, test } from 'vitest';

import { onlyPasses, SELECTING_BIN } from '../_setup/check-passes.js';
import { temporaryDirectory } from '../_setup/temporary-directory.js';

const FIXTURE = resolve(import.meta.dirname, '_fixtures/fix-wrapper-unwritable');

describe('fix-wrapper-unwritable', () => {
    test('refuses in four parts, fails, and leaves no wrapper where one directory is read-only', () => {
        // Given - a clean tree, a root config over a nested one whose directory the run may not write to
        const project = temporaryDirectory('spec-fix-wrapper-');
        cpSync(FIXTURE, project, { recursive: true });
        chmodSync(resolve(project, 'sub'), 0o555);
        onTestFinished(() => {
            chmodSync(resolve(project, 'sub'), 0o755);
        });

        // When - the fix runs
        const fixed = spawnSync(process.execPath, [SELECTING_BIN, 'fix'], {
            cwd: project,
            encoding: 'utf8',
            env: { ...process.env, ...onlyPasses('oxlint') },
        });

        // Then - the pass fails on the refusal, and the root's wrapper written before it is gone
        expect(fixed.status).toBe(1);
        expect(fixed.stdout).toContain('found: the fix wrapper could not be written');
        expect(fixed.stdout).toContain('✗ Some checks failed');
        expect(existsSync(resolve(project, 'oxlint.fix.config.mjs'))).toBe(false);
        expect(existsSync(resolve(project, 'sub/oxlint.fix.config.mjs'))).toBe(false);
    });
});
