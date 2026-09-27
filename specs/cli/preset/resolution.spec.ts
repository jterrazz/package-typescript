import { describe, expect, test } from 'vitest';

import { PACKAGE_ROOT, cli as resolutionCli } from '../resolution.specification.js';

// A document's `command:` is fixed text and cannot name this checkout's absolute path.

describe('resolution', () => {
    test('resolves each tool independently when npm splits them between bin dirs', async () => {
        // Given - oxlint nested under the package, the other tools hoisted to the consumer root
        const result = await resolutionCli.exec(PACKAGE_ROOT);

        // Then - the whole check output matches: every tool is found and runs, wherever npm placed it
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(`
             START  Running quality checks

             RUN  TypeScript Check

            ✓ Passed

             RUN  Oxlint Check

            jterrazz.baseline.json › typescript: nothing held
            ✓ Passed

             RUN  Oxfmt Check

            ✓ Passed

             RUN  Knip (unused code)

            ✓ Passed

             RUN  Suppressions (directives)

            ✓ Passed

             RUN  Markdown (prose)

            ✓ Passed

             RUN  Names (tree)

            ✓ Passed

             RUN  Comments (density)

            ✓ Passed

             RUN  Secrets (credentials)

            ✓ Passed

             DRIFT  Deviations from the profile

              profile                              node (the default — no config of its own)
              rules off vs profile                 none
              suppressions                         0
              jterrazz.baseline.json › typescript  nothing held
              tool versions                        tsc (Go) absent, typescript absent, oxlint absent, oxfmt absent, oxlint-tsgolint absent, knip absent, dependency-cruiser absent, ls-lint absent, rumdl absent

             END  Finalizing quality checks

            ✓ All checks passed
        `);
    });
});
