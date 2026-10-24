import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { astroStub, astroStubFailingSync } from '../__setup__/astro.js';
import { onlyPasses } from '../__setup__/check-passes.js';
import { cli } from '../cli.specification.js';

// outside: the Astro pass runs the consumer's `astro check`, so the project carries a binary where npm would put one, under node_modules/, which no fixture can hold.

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

    test('fixes a module by the types astro sync writes, which a fresh clone lacks', async () => {
        // Given - a middleware comparing an imported boolean to true and declaring with let what it never reassigns, no .astro/ folder yet, and the lint alone
        const result = await cli
            .with({ env: onlyPasses('oxlint') })
            .fixture(directory('../__fixtures__/astro/fixed/'))
            .prepare(astroStub)
            .exec('fix');

        // Then - astro sync ran before the fixers, so the type-aware fix knew the value a boolean (the formatter, not selected, closes the gap)
        expect(result.exitCode).toBe(0);
        expect(result.file('src/middleware.ts').content).toMatch(/[=]> +enabled;/u);
        expect(result.file('src/middleware.ts').content).toContain("const label = 'on';");
    });

    test('fails the fix with the report when astro sync fails, and fixes nothing past it', async () => {
        // Given - the same middleware, and an astro whose sync fails
        const result = await cli
            .with({ env: onlyPasses('oxlint') })
            .fixture(directory('../__fixtures__/astro/fixed/'))
            .prepare(astroStubFailingSync)
            .exec('fix');

        // Then - the lint prints the sync's report once, and no fixer touched the module, the type-blind one included
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toMatch(`
             START  Running quality fixes

             RUN  Oxlint Fix

            astro-sync-failed
            ✗ Failed with exit code 1 ({{duration}})

             END  Finalizing quality fixes

            ✗ Some checks failed, first Oxlint Fix: astro-sync-failed
        `);
        expect(result.file('src/middleware.ts').content).toContain('=> enabled === true;');
        expect(result.file('src/middleware.ts').content).toContain("let label = 'on';");
    });
});
