import { directory } from '@jterrazz/test';
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

            ✓ Passed

             RUN  Gitignore (artefacts)

            ✓ Passed

             RUN  Docs (layout)

            ✓ Passed

             RUN  Comments (styles, scripts, YAML)

            ✓ Passed

             RUN  Markdown (prose)

            ✓ Passed

             RUN  Names (tree)

            ✓ Passed

             RUN  Secrets (credentials)

            ✓ Passed

             END  Finalizing quality checks

            ✓ All checks passed
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
