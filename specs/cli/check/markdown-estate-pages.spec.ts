import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { onlyPasses } from '../__setup__/check-passes.js';
import { repository } from '../__setup__/repository.js';
import { cli } from '../cli.specification.js';

describe('markdown-estate-pages', () => {
    test('forgives a link into a tree git ignores, a prompt titled by its name and a frozen record, and refuses a link to nothing', async () => {
        // Given - a README linking a clone git ignores and a page never written, an agent page titled by `name:`, a numbered record naming a renamed folder
        const result = await cli
            .with({ env: onlyPasses('markdown') })
            .fixture(directory('./__fixtures__/markdown/estate-pages/'))
            .prepare(repository)
            .exec('check');

        // Then - only the link to nothing is reported, at its position
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toMatch(`
             START  Running quality checks

             RUN  Markdown (prose)

            README.md:3:71: error markdown(link-resolves): Relative link 'notes/plan.md' does not exist
            ✗ Failed with exit code 1 ({{duration}})

             END  Finalizing quality checks

            ✗ Some checks failed
        `);
    });
});
