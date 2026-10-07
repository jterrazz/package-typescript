import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { FORMATTED, formatter, MISFORMATTED, sweptRepository } from '../__setup__/format-sweep.js';

describe('format-sweep', () => {
    test('judges no ground file and no ignored file, with no oxfmt config to say so', async () => {
        // Given - formatted source files, tracked and new, beside a misformatted ground file and a misformatted ignored file
        // When - the quality checks run
        const result = await formatter
            .fixture(directory('../__fixtures__/format-sweep/formatted/'))
            .prepare(sweptRepository(FORMATTED))
            .exec('check');

        // Then - the Oxfmt pass is green
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(`
             START  Running quality checks

             RUN  Oxfmt Check

            ✓ Passed

             END  Finalizing quality checks

            ✓ All checks passed
        `);
    });

    test('refuses the source files it would reformat, tracked or new, and only those', async () => {
        // Given - the same project, whose tracked source file and new source file are misformatted
        // When - the quality checks run
        const result = await formatter
            .fixture(directory('../__fixtures__/format-sweep/misformatted/'))
            .prepare(sweptRepository(MISFORMATTED))
            .exec('check');

        // Then - the Oxfmt pass fails on the two source files alone
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toMatch(`
             START  Running quality checks

             RUN  Oxfmt Check

            Checking formatting...

            src/added.ts ({{duration}})
            src/index.ts ({{duration}})

            Format issues found in above 2 files. Run without \`--check\` to fix.
            Finished in {{duration}} on 3 files using {{int}} threads.
            ✗ Failed with exit code 1

             END  Finalizing quality checks

            ✗ Some checks failed
        `);
    });
});
