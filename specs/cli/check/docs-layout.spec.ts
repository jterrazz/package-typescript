import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { onlyPasses } from '../_setup/check-passes.js';
import { git } from '../_setup/repository.js';
import { cli } from '../cli.specification.js';

describe('docs-layout', () => {
    test('asks a repository for its manual', async () => {
        // Given - a project on the convention, made a repository, with no docs/
        const result = await cli
            .with({ env: onlyPasses('docs') })
            .fixture(directory('./_fixtures/gitignore/on-convention/'))
            .prepare((workdir) => {
                git(workdir, 'init', '--quiet');
            })
            .exec('check');

        // Then - the layout pass asks for the manual every repository carries; a bare directory is asked nothing (gitignore-on-convention.spec.yaml)
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toMatch(`
             START  Running quality checks

             RUN  Docs (layout)

            docs/:1:1: error docs(manual-present): docs/ is missing — every repository carries its own manual, starting at docs/README.md
            ✗ Failed with exit code 1

             END  Finalizing quality checks

            ✗ Some checks failed
        `);
    });
});
