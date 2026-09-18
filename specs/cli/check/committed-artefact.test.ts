import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterAll, expect, test } from 'vitest';

/*
 * A chain, not a document — and the product command all the same. What no
 * document can state here is the GROUND: this scenario needs a real git
 * repository, and a fixture cannot be one (git refuses to track a nested `.git`,
 * and the runner copies files, it does not initialise a repo). So the ground is
 * built here, the product binary runs in it, and the claim is the gate's own.
 */

const BIN = resolve(import.meta.dirname, '../../../bin/typescript.sh');
const FIXTURE = resolve(import.meta.dirname, '_fixtures/gitignore/on-convention');
const TURBO_FIXTURE = resolve(import.meta.dirname, '_fixtures/gitignore/turbo');

const workDir = mkdtempSync(resolve(tmpdir(), 'spec-committed-artefact-'));
const turboWorkDir = mkdtempSync(resolve(tmpdir(), 'spec-committed-turbo-'));

afterAll(() => {
    rmSync(workDir, { force: true, recursive: true });
    rmSync(turboWorkDir, { force: true, recursive: true });
});

test('fails a repository that has committed an artefact', () => {
    // Given - a project on the convention, in a git repository that tracks a buildinfo
    cpSync(FIXTURE, workDir, { recursive: true });
    writeFileSync(resolve(workDir, 'tsconfig.tsbuildinfo'), '{"version":"stale"}\n');
    execFileSync('git', ['init', '--quiet'], { cwd: workDir });
    execFileSync('git', ['add', '--force', 'tsconfig.tsbuildinfo'], { cwd: workDir });

    // When - the quality checks run
    const result = spawnSync('bash', [BIN, 'check'], { cwd: workDir, encoding: 'utf8' });

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
    const result = spawnSync('bash', [BIN, 'check'], { cwd: turboWorkDir, encoding: 'utf8' });

    // Then - ignoring the directory is granted, committing its contents is not
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('Artefacts must never be committed:');
    expect(result.stdout).toContain(
        '.turbo/turbo-build.log is tracked — git rm --cached .turbo/turbo-build.log',
    );
    expect(result.stdout).not.toContain('its home is .artifacts/turbo/');
});
