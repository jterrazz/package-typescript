import { directory, file } from '@jterrazz/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { onlyPasses } from '../__setup__/check-passes.js';
import { git } from '../__setup__/repository.js';
import { cli } from '../cli.specification.js';

const bounded = cli
    .with({ env: onlyPasses('gitignore') })
    .fixture(directory('./__fixtures__/gitignore/repository-boundary/'));

describe('gitignore-boundary', () => {
    test("reads the parent's .gitignore when nothing marks a boundary", async () => {
        // Given - a clone whose parent folder's .gitignore names coverage/, with no .git between them
        // When - the gate runs from the clone
        const result = await bounded.exec('check', { cwd: 'clone' });

        // Then - the parent's line is judged as the clone's own
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toMatch(`
             START  Running quality checks

             RUN  Gitignore (artefacts)

            Artefacts belong under .artifacts/<tool>/ at the project root:
              ✗ ../.gitignore names coverage/ — its home is .artifacts/vitest/coverage/
            Run 'typescript fix' to rewrite .gitignore.
            ✗ Failed with exit code 1 ({{duration}})

             END  Finalizing quality checks

            ✗ Some checks failed
        `);
    });

    test('stops at a .git DIRECTORY — a clone inside another repository', async () => {
        // Given - the same clone, made a repository of its own
        // When - the gate runs from the clone
        const result = await bounded
            .prepare((workdir) => {
                git(join(workdir, 'clone'), 'init', '--quiet');
            })
            .exec('check', { cwd: 'clone' });

        // Then - the walk stops at the clone: only its own .gitignore is read, and it holds the convention
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(file('./__expected__/gitignore-boundary/bounded.txt'));
    });

    test('stops at a .git FILE — a worktree inside another repository', async () => {
        // Given - the same clone, a worktree whose .git file points at a repository beside it
        // When - the gate runs from the clone
        const result = await bounded
            .prepare((workdir) => {
                mkdirSync(join(workdir, 'bare.git'));
                writeFileSync(
                    join(workdir, 'clone/.git'),
                    `gitdir: ${join(workdir, 'bare.git')}\n`,
                );
            })
            .exec('check', { cwd: 'clone' });

        // Then - a .git file is a boundary as a .git folder is
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(file('./__expected__/gitignore-boundary/bounded.txt'));
    });
});
