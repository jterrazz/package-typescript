import { cli, defineSpecConfig, unit } from '@jterrazz/test/vitest';

export default defineSpecConfig({
    test: {
        projects: [
            unit({
                exclude: ['**/*.test.tsx'],
                include: [
                    'specs/cli/preset/declarations.test.ts',
                    'specs/cli/preset/exports.test.ts',
                    'rules/**/*.test.ts',
                    'src/**/*.test.ts',
                ],
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
                    'specs/cli/preset/declarations.test.ts',
                    'specs/cli/preset/exports.test.ts',
                    /*
                     * Bridged documents: a .test.ts beside each one runs it and adds the
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
