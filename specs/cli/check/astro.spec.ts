import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { astroStub } from '../_setup/astro.js';
import { onlyPasses } from '../_setup/check-passes.js';
import { cli } from '../cli.specification.js';

// outside: the Astro pass runs the consumer's `astro check`, so the project carries a binary where npm would put one — under node_modules/, which no fixture can hold.

const site = cli
    .with({ env: onlyPasses('astro') })
    .fixture(directory('../_fixtures/astro/site/'))
    .prepare(astroStub);

describe('astro', () => {
    test("refuses a template the project's own checker and the formatter both refuse", async () => {
        // Given - a website declared on astro, with one badly shaped template
        // When - the quality checks run there
        const result = await site.exec('check');

        // Then - the pass ran the project's own checker and refused the template's shape
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toMatch(`
             START  Running quality checks

             RUN  Astro (check + format)

            astro-check-ran
            Checking formatting...
            [warn] src/page.astro
            [warn] Code style issues found in the above file. Run Prettier with --write to fix.
            ✗ Failed with exit code 1

             END  Finalizing quality checks

            ✗ Some checks failed
        `);
    });

    test('runs in the workspace member that declares astro, though the root declares no platform', async () => {
        // Given - a workspace whose one member is a website on astro, with a badly shaped template, astro hoisted to the root
        // When - the Astro pass runs at the workspace root
        const result = await cli
            .with({ env: onlyPasses('astro') })
            .fixture(directory('../_fixtures/astro/workspace/'))
            .prepare(astroStub)
            .exec('check');

        // Then - it ran the member's checker and refused the member's template
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toMatch(`
             START  Running quality checks

             RUN  Astro (check + format)

            packages/site
            astro-check-ran
            Checking formatting...
            [warn] src/page.astro
            [warn] Code style issues found in the above file. Run Prettier with --write to fix.
            ✗ Failed with exit code 1

             END  Finalizing quality checks

            ✗ Some checks failed
        `);
    });
});
