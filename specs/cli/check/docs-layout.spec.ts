import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { onlyPasses } from '../__setup__/check-passes.js';
import { git } from '../__setup__/repository.js';
import { cli } from '../cli.specification.js';

describe('docs-layout', () => {
    test('asks a repository for its manual', async () => {
        // Given - a project on the convention, made a repository, with no docs/
        const result = await cli
            .with({ env: onlyPasses('docs') })
            .fixture(directory('./__fixtures__/gitignore/on-convention/'))
            .prepare((workdir) => {
                git(workdir, 'init', '--quiet');
            })
            .exec('check');

        // Then - the layout pass asks for the manual every repository carries; a bare directory is asked nothing (gitignore-on-convention.spec.yaml)
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toMatch(`
             START  Running quality checks

             RUN  Docs (layout)

            docs/:1:1: error docs(manual-present): docs/ is missing: every repository carries its own manual, starting at docs/README.md
            ✗ Failed with exit code 1 ({{duration}})

             END  Finalizing quality checks

            ✗ Some checks failed, first Docs (layout): docs/:1:1: error docs(manual-present): docs/ is missing: every repository carries its own manual, starting at docs/README.md
        `);
    });

    test('asks a workspace for its release guide when one of its members is published', async () => {
        // Given - a workspace root that publishes nothing itself, one member a library npm publishes, and a manual with no release guide
        const result = await cli
            .with({ env: onlyPasses('docs') })
            .fixture(directory('./__fixtures__/docs/workspace-member-published/'))
            .prepare((workdir) => {
                git(workdir, 'init', '--quiet');
            })
            .exec('check');

        // Then - the member's publication is the reason the guide is asked for
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toMatch(`
             START  Running quality checks

             RUN  Docs (layout)

            docs/guides/release.md:1:1: error docs(release-guide-present-when-shipping): guides/release.md is missing, and this repository ships a published package (it declares a library or a cli)
            ✗ Failed with exit code 1 ({{duration}})

             END  Finalizing quality checks

            ✗ Some checks failed, first Docs (layout): docs/guides/release.md:1:1: error docs(release-guide-present-when-shipping): guides/release.md is missing, and this repository ships a published package (it declares a library or a cli)
        `);
    });

    test('asks no release guide of a workspace whose only library member is private', async () => {
        // Given - the same workspace, its library member marked private
        const result = await cli
            .with({ env: onlyPasses('docs') })
            .fixture(directory('./__fixtures__/docs/workspace-member-private/'))
            .prepare((workdir) => {
                git(workdir, 'init', '--quiet');
            })
            .exec('check');

        // Then - nothing is published, so the guide is not asked for
        expect(result.exitCode).toBe(0);
    });
});
