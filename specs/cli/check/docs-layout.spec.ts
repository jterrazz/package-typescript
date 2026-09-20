import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterAll, expect, test } from 'vitest';

/*
 * A chain, not a document — and the product command all the same. What no
 * document can state here is the GROUND: the Docs (layout) pass asks its
 * question where a REPOSITORY is, and a fixture cannot be one (git refuses to
 * track a nested `.git`, and the runner copies files, it does not initialise a
 * repo). The shape of the pass, rule by rule, is stated by the documents of
 * `specs/cli/docs-layout/`; what is claimed here is where it speaks and where
 * it does not.
 */

const BIN = resolve(import.meta.dirname, '../../../bin/typescript.sh');
const FIXTURE = resolve(import.meta.dirname, '_fixtures/gitignore/on-convention');

const repository = mkdtempSync(resolve(tmpdir(), 'spec-docs-layout-repo-'));
const looseDirectory = mkdtempSync(resolve(tmpdir(), 'spec-docs-layout-loose-'));

afterAll(() => {
    rmSync(repository, { force: true, recursive: true });
    rmSync(looseDirectory, { force: true, recursive: true });
});

test('asks a repository for its manual, and a bare directory for nothing', () => {
    // Given - the same project with no docs/, once as a git repository and once not
    cpSync(FIXTURE, repository, { recursive: true });
    execFileSync('git', ['init', '--quiet'], { cwd: repository });
    cpSync(FIXTURE, looseDirectory, { recursive: true });

    // When - the quality checks run in each
    const inside = spawnSync('bash', [BIN, 'check'], { cwd: repository, encoding: 'utf8' });
    const outside = spawnSync('bash', [BIN, 'check'], { cwd: looseDirectory, encoding: 'utf8' });

    // Then - the pass names the missing manual where a repository carries one
    expect(inside.status).toBe(1);
    expect(inside.stdout).toContain('Docs (layout)');
    expect(inside.stdout).toContain(
        'docs-absent  docs/  docs/ is missing — every repository carries its own manual',
    );

    // Then - and never runs where there is no repository to carry one
    expect(outside.status).toBe(0);
    expect(outside.stdout).not.toContain('Docs (layout)');
});
