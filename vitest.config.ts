import { cli, defineSpecConfig, unit } from '@jterrazz/test/vitest';

export default defineSpecConfig({
    test: {
        projects: [
            /*
             * `src/` and `rules/` hold the module tests, and `specs/surface/` is
             * the repository suite — the third door: a first-level folder under
             * `specs/` that is no facet, covering this package's published tree
             * rather than a product reached through an entry. The globs are
             * stated outright because the default set excludes `specs/` whole.
             */
            unit({
                exclude: ['**/*.test.tsx'],
                include: ['rules/**/*.test.ts', 'specs/surface/**/*.test.ts', 'src/**/*.test.ts'],
            }),
            /*
             * The spec documents run here, beside the chains that still need code.
             * `cli()` binds every `<case>.spec.yaml` to ONE runner, and the one this
             * repo tests through is the product command (B9). The three B9w exception
             * runners — oxfmt, oxlint, run-split-install.sh — therefore keep their
             * chains: a document cannot name the binary it runs.
             */
            cli({
                exclude: [
                    /*
                     * Bridged documents: a .spec.ts beside each one runs it and adds the
                     * assertion the format has no vocabulary for. Collecting them here
                     * too would compile the same typedoc projection twice.
                     */
                    'specs/cli/docs/projection.spec.yaml',
                    'specs/cli/docs/workspace-members.spec.yaml',
                ],
            }),
        ],
    },
});
