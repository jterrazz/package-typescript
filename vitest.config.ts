import { cli, defineSpecConfig, unit } from '@jterrazz/test/vitest';
import { resolve } from 'node:path';
import { mergeConfig } from 'vitest/config';

/** The per-test budget of a `cli` spec, which runs the whole toolchain — the reason is docs/03-testing.md's. */
const TOOLCHAIN_BUDGET_MS = 120_000;

export default defineSpecConfig({
    test: {
        projects: [
            /*
             * `src/` and `lint/` hold the module tests, and `specs/surface/` is
             * the repository suite — the third door: a first-level folder under
             * `specs/` that is no facet, covering this package's published tree
             * rather than a product reached through an entry. The globs are
             * stated outright because the default set excludes `specs/` whole.
             *
             * No module test mocks a module or writes a global, so one worker's
             * files share their module graph (`isolate: false`).
             */
            mergeConfig(
                unit({
                    exclude: ['**/*.test.tsx'],
                    include: [
                        'lint/**/*.test.ts',
                        'specs/surface/**/*.test.ts',
                        'src/**/*.test.ts',
                    ],
                }),
                { test: { isolate: false } },
            ),
            /*
             * The spec documents run here, beside the chains that still need code.
             * `cli()` binds every `<case>.spec.yaml` to ONE runner, and the one this
             * repo tests through is the product command (B9). The three B9w exception
             * runners — oxfmt, oxlint, run-split-install.sh — therefore keep their
             * chains: a document cannot name the binary it runs.
             *
             * Every directory a spec creates sits under one temp root per run.
             */
            mergeConfig(cli({ timeout: TOOLCHAIN_BUDGET_MS }), {
                test: {
                    globalSetup: [resolve(import.meta.dirname, 'specs/cli/run-temp-root.ts')],
                },
            }),
        ],
    },
});
