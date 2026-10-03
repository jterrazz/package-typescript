import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, describe, expect, test } from 'vitest';

import { newDirectory } from '../../_shared/_setup/temporary-directory.js';
import { TYPESCRIPT_BIN } from '../_setup/check-passes.js';

// outside: git refuses to track a nested `.git`, so a fixture cannot be the repository this needs.

const FIXTURE = resolve(import.meta.dirname, '_fixtures/gitignore/on-convention');
const TURBO_FIXTURE = resolve(import.meta.dirname, '_fixtures/gitignore/turbo');

const workDir = newDirectory('spec-committed-artefact-');
const turboWorkDir = newDirectory('spec-committed-turbo-');

afterAll(() => {
    rmSync(workDir, { force: true, recursive: true });
    rmSync(turboWorkDir, { force: true, recursive: true });
});

describe('committed-artefact', () => {
    test('fails a repository that has committed an artefact', () => {
        // Given - a project on the convention, in a git repository that tracks a buildinfo
        cpSync(FIXTURE, workDir, { recursive: true });
        writeFileSync(resolve(workDir, 'tsconfig.tsbuildinfo'), '{"version":"stale"}\n');
        execFileSync('git', ['init', '--quiet'], { cwd: workDir });
        execFileSync('git', ['add', '--force', 'tsconfig.tsbuildinfo'], { cwd: workDir });

        // When - the quality checks run
        const result = spawnSync('node', [TYPESCRIPT_BIN, 'check'], {
            cwd: workDir,
            encoding: 'utf8',
        });

        // Then - the gate names the committed artefact and how to untrack it
        expect(result.status).toBe(1);
        expect(result.stdout).toContain('Artefacts must never be committed:');
        expect(result.stdout).toContain(
            'tsconfig.tsbuildinfo is tracked — git rm --cached tsconfig.tsbuildinfo',
        );
    });

    test('fails a repository that has committed a file under .turbo/', () => {
        // Given - a project whose ignored .turbo/ is allowed, with one of its logs tracked
        cpSync(TURBO_FIXTURE, turboWorkDir, { recursive: true });
        mkdirSync(resolve(turboWorkDir, '.turbo'));
        writeFileSync(resolve(turboWorkDir, '.turbo/turbo-build.log'), 'cache miss\n');
        execFileSync('git', ['init', '--quiet'], { cwd: turboWorkDir });
        execFileSync('git', ['add', '--force', '.turbo/turbo-build.log'], { cwd: turboWorkDir });

        // When - the quality checks run
        const result = spawnSync('node', [TYPESCRIPT_BIN, 'check'], {
            cwd: turboWorkDir,
            encoding: 'utf8',
        });

        // Then - ignoring the directory is granted, committing its contents is not
        expect(result.status).toBe(1);
        expect(result.stdout).toContain('Artefacts must never be committed:');
        expect(result.stdout).toContain(
            '.turbo/turbo-build.log is tracked — git rm --cached .turbo/turbo-build.log',
        );
        expect(result.stdout).not.toContain('its home is .artifacts/turbo/');
    });
});
