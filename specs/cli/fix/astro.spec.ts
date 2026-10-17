import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { astroStub } from '../__setup__/astro.js';
import { onlyPasses } from '../__setup__/check-passes.js';
import { cli } from '../cli.specification.js';

// outside: the Astro pass runs the consumer's `astro check`, so the project carries a binary where npm would put one — under node_modules/, which no fixture can hold.

const site = cli
    .with({ env: onlyPasses('astro') })
    .fixture(directory('../__fixtures__/astro/site/'))
    .prepare(astroStub);

describe('astro', () => {
    test('the formatter rewrites the template it refused', async () => {
        // Given - a website declared on astro, with one badly shaped template
        // When - the fixes run there
        const result = await site.exec('fix');

        // Then - the formatter names the file it rewrote
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(`
             START  Running quality fixes

             RUN  Astro (check + format)

            astro-check-ran
            src/page.astro {{duration}}
            ✓ Passed ({{duration}})

             END  Finalizing quality fixes

            ✓ All checks passed
        `);
    });

    test('a check after the fixes has nothing left to say about the template', async () => {
        // Given - the same website, its fixes run first
        // When - the quality checks run again
        const result = await site.exec(['fix', 'check']);

        // Then - the pass no longer reports
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(`
             START  Running quality checks

             RUN  Astro (check + format)

            ✓ Passed ({{duration}})

             END  Finalizing quality checks

            ✓ All checks passed
        `);
    });
});
