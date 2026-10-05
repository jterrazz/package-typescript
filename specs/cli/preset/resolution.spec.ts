import { describe, expect, test } from 'vitest';

import { cli as resolutionCli } from '../resolution.specification.js';

describe('resolution', () => {
    test('resolves each tool independently when npm splits them between bin dirs', async () => {
        // Given - oxlint nested under the package, the other tools and the typescript it depends on hoisted to the consumer root
        const result = await resolutionCli.exec();

        // Then - the whole check output matches: every tool is found and runs, wherever npm placed it
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(`
             START  Running quality checks

             RUN  Config (one file)

            ✓ Passed

             RUN  TypeScript Check

            ✓ Passed

             RUN  Oxlint Check

            ✓ Passed

             RUN  Oxfmt Check

            ✓ Passed

             RUN  Knip (unused code)

            ✓ Passed

             RUN  Architecture (layer map)

            ✓ Passed

             RUN  Suppressions (directives)

            ✓ Passed

             RUN  Markdown (prose)

            ✓ Passed

             RUN  Names (tree)

            ✓ Passed

             RUN  Secrets (credentials)

            ✓ Passed

             DRIFT  Deviations from the profile

              declared                              api on node
              exceptions                            0
              rules off vs profile                  none
              suppressions                          0
              .jterrazz/oxlint-suppressions.json    nothing held
              .jterrazz/baseline.json › typescript  nothing held
              tool versions                         tsc (Go) absent, oxlint absent, oxfmt absent, oxlint-tsgolint absent, knip absent, dependency-cruiser absent, ls-lint absent, rumdl absent

             END  Finalizing quality checks

            ✓ All checks passed
        `);
    });
});
