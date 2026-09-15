import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, resolve } from 'node:path';
import { afterAll, expect, test } from 'vitest';

/*
 * A chain, not a document — and the product command all the same. What no
 * document can state here is the MACHINE: the Secrets pass runs gitleaks where
 * the machine has it and its own ten patterns where it does not, so the block a
 * document would freeze is a property of the developer's PATH, not of the
 * command. The chain names the engine by handing over a PATH without gitleaks
 * on it, and asserts the one thing that must hold on every machine: the leak
 * fails the run, and the line that declares itself fake does not.
 */

const BIN = resolve(import.meta.dirname, '../../../bin/typescript.sh');
const FIXTURE = resolve(import.meta.dirname, '_fixtures/secrets/leaked');

const project = mkdtempSync(resolve(tmpdir(), 'spec-secrets-'));

afterAll(() => {
    rmSync(project, { force: true, recursive: true });
});

/** The machine's PATH, minus any directory that answers for `gitleaks`. */
function pathWithoutGitleaks(): string {
    const probe = spawnSync('which', ['gitleaks'], { encoding: 'utf8' });
    const binary = probe.stdout.trim();

    const { PATH = '' } = process.env;

    return PATH.split(delimiter)
        .filter((directory) => binary === '' || !binary.startsWith(`${directory}/`))
        .join(delimiter);
}

test('refuses a committed credential, and forgives the line that declares itself fake', () => {
    // Given - a project whose notes carry one live-looking key and one declared-fake key
    cpSync(FIXTURE, project, { recursive: true });

    // When - the quality checks run with no gitleaks on PATH, so the built-in patterns answer
    const result = spawnSync('bash', [BIN, 'check'], {
        cwd: project,
        encoding: 'utf8',
        env: { ...process.env, PATH: pathWithoutGitleaks() },
    });

    // Then - the pass names the live-looking key, by rule id, file and line
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('Secrets (credentials)');
    expect(result.stdout).toContain(
        'secrets-aws-key  NOTES.md  line 3 looks like an aws access key',
    );

    // Then - and says nothing about the line that declares itself a sample
    expect(result.stdout).not.toContain('line 5');
});
