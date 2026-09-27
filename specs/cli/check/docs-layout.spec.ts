import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, describe, expect, test } from 'vitest';

import { newDirectory } from '../_setup/temporary-directory.js';

// git refuses to track a nested `.git`, so a fixture cannot be the repository the pass asks for.

const BIN = resolve(import.meta.dirname, '../../../bin/typescript.js');
const FIXTURE = resolve(import.meta.dirname, '_fixtures/gitignore/on-convention');

const repository = newDirectory('spec-docs-layout-repo-');
const looseDirectory = newDirectory('spec-docs-layout-loose-');

afterAll(() => {
    rmSync(repository, { force: true, recursive: true });
    rmSync(looseDirectory, { force: true, recursive: true });
});

describe('docs-layout', () => {
    test('asks a repository for its manual, and a bare directory for nothing', () => {
        // Given - the same project with no docs/, once as a git repository and once not
        cpSync(FIXTURE, repository, { recursive: true });
        execFileSync('git', ['init', '--quiet'], { cwd: repository });
        cpSync(FIXTURE, looseDirectory, { recursive: true });

        // When - the quality checks run in each
        const inside = spawnSync('node', [BIN, 'check'], { cwd: repository, encoding: 'utf8' });
        const outside = spawnSync('node', [BIN, 'check'], {
            cwd: looseDirectory,
            encoding: 'utf8',
        });

        // Then - the pass names the missing manual where a repository carries one
        expect(inside.status).toBe(1);
        expect(inside.stdout).toContain('Docs (layout)');
        expect(inside.stdout).toContain(
            'docs/:1:1: error docs(manual-present): docs/ is missing — every repository carries its own manual',
        );

        // Then - and never runs where there is no repository to carry one
        expect(outside.status).toBe(0);
        expect(outside.stdout).not.toContain('Docs (layout)');
    });
});
