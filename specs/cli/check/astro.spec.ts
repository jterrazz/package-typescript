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
            ✗ Failed with exit code 1 ({{duration}})

             END  Finalizing quality checks

            ✗ Some checks failed — first Astro (check + format): astro-check-ran
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

    test('runs in the workspace member that declares astro, though the root declares no platform', async () => {
        // Given - a workspace whose one member is a website on astro, with a badly shaped template, astro hoisted to the root
        // When - the Astro pass runs at the workspace root
        const result = await cli
            .with({ env: onlyPasses('astro') })
            .fixture(directory('../__fixtures__/astro/workspace/'))
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
            ✗ Failed with exit code 1 ({{duration}})

             END  Finalizing quality checks

            ✗ Some checks failed — first Astro (check + format): packages/site
        `);
    });

    test('type-checks a module importing the types astro sync writes, which a fresh clone lacks', async () => {
        // Given - a website on astro whose middleware imports astro:middleware, and no .astro/ folder yet
        const result = await cli
            .with({ env: onlyPasses('typescript') })
            .fixture(directory('../__fixtures__/astro/synced/'))
            .prepare(astroStub)
            .exec('check');

        // Then - astro sync ran first, so the module types resolve and the check passes
        expect(result.exitCode).toBe(0);
        expect(result.file('.astro/types.d.ts').exists).toBe(true);
    });

    test('fails the type check and the Astro pass alike, each with the report, when astro sync fails, and checks nothing past it', async () => {
        // Given - the same middleware, and an astro whose sync fails
        const result = await cli
            .with({ env: onlyPasses('typescript', 'astro') })
            .fixture(directory('../__fixtures__/astro/synced/'))
            .prepare(astroStubFailingSync)
            .exec('check');

        // Then - both passes print the sync's report, and neither the type check nor astro check ran
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toMatch(`
             START  Running quality checks

             RUN  TypeScript Check

            astro-sync-failed
            ✗ Failed with exit code 1 ({{duration}})

             RUN  Astro (check + format)

            astro-sync-failed
            ✗ Failed with exit code 1 ({{duration}})

             END  Finalizing quality checks

            ✗ Some checks failed — first TypeScript Check: astro-sync-failed
        `);
    });
});
