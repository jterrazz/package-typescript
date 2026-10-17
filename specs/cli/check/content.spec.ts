import { directory } from '@jterrazz/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { repository } from '../__setup__/repository.js';
import { cli } from '../cli.specification.js';

const clean = cli.fixture(directory('./__fixtures__/content/clean/'));

describe('content', () => {
    test('a repository with no code, made a repository, is asked for its manual beside the other six passes of content', async () => {
        // Given - a content repository holding a manual, charts, a release script and a script no type check or linter would pass
        const result = await clean.prepare(repository).exec('check');

        // Then - the manual is judged beside the others, and no pass of code ran
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(`
             START  Running quality checks

             RUN  Config (one file)

            ✓ Passed ({{duration}})

             RUN  Gitignore (artefacts)

            ✓ Passed ({{duration}})

             RUN  Docs (layout)

            ✓ Passed ({{duration}})

             RUN  Comments (styles, scripts, YAML)

            ✓ Passed ({{duration}})

             RUN  Markdown (prose)

            ✓ Passed ({{duration}})

             RUN  Names (tree)

            ✓ Passed ({{duration}})

             RUN  Secrets (credentials)

            ✓ Passed ({{duration}})

             END  Finalizing quality checks

            ✓ All checks passed
        `);
    });

    test('names the folders a content repository leaves empty, and judges it by no spine of roots', async () => {
        // Given - the same repository with a folder git does not track, since it holds no file
        const result = await clean
            .prepare(repository)
            .prepare((workdir) => {
                mkdirSync(join(workdir, 'drafts'));
            })
            .exec('check');

        // Then - the empty folder is the only finding of the Names pass: charts/ and scripts/ stand outside any spine
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toMatch(`
             START  Running quality checks

             RUN  Config (one file)

            ✓ Passed ({{duration}})

             RUN  Gitignore (artefacts)

            ✓ Passed ({{duration}})

             RUN  Docs (layout)

            ✓ Passed ({{duration}})

             RUN  Comments (styles, scripts, YAML)

            ✓ Passed ({{duration}})

             RUN  Markdown (prose)

            ✓ Passed ({{duration}})

             RUN  Names (tree)

            drafts/:1:1: error names(no-empty-directory): found: \`drafts/\` holds no file · why: git tracks no directory, so an empty one exists only on this machine and names a part of the tree that is not there · fix: delete it — \`typescript fix\` does — or put the file it was made for in it · read: docs/reference/quality-checks.md#an-empty-directory
            found: every finding above, and .jterrazz/baseline.json records no \`names/\` entry in its \`typescript\` section to hold one · why: a project that recorded no debt is held at zero, so each finding fails the run as new debt · fix: fix them, or run 'typescript baseline' to record where the project stands · read: docs/reference/quality-checks.md#what-jterrazzbaselinejson-still-holds
            ✗ Failed with exit code 1 ({{duration}})

             RUN  Secrets (credentials)

            ✓ Passed ({{duration}})

             END  Finalizing quality checks

            ✗ Some checks failed
        `);
    });

    test('a baseline of a content repository leaves the scripts it carries to no linter', async () => {
        // Given - the same repository, whose script holds what oxlint would record as a suppression
        const result = await clean.exec('baseline');

        // Then - the linter's ledger is not written
        expect(result.exitCode).toBe(0);
        expect(result.file('.jterrazz/oxlint-suppressions.json').exists).toBe(false);
    });
});
