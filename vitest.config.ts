import { literate } from '@jterrazz/test/vitest';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        projects: [
            {
                test: {
                    name: 'fast',
                    include: ['specs/cli/preset/exports.test.ts', 'src/**/*.test.ts'],
                    exclude: ['**/fixtures/**', 'node_modules/**', 'dist/**'],
                },
            },
            {
                /*
                 * The spec documents run here, beside the chains that still need code.
                 * `literate()` binds every `<case>.spec.yaml` to ONE runner, and the one
                 * this repo tests through is the product command (B9). The three B9w
                 * exception runners — oxfmt, oxlint, run-split-install.sh — therefore keep
                 * their chains: a document cannot name the binary it runs.
                 */
                plugins: [literate({ specification: './specs/cli/cli.specification.ts' })],
                test: {
                    name: 'e2e',
                    include: ['specs/**/*.test.ts'],
                    exclude: [
                        'specs/cli/preset/exports.test.ts',
                        /*
                         * Bridged documents: a .test.ts beside each one runs it and adds the
                         * assertion the format has no vocabulary for. Collecting them here
                         * too would compile the same typedoc projection twice.
                         */
                        'specs/cli/docs/projection.spec.yaml',
                        'specs/cli/docs/workspace-members.spec.yaml',
                        '**/fixtures/**',
                        'node_modules/**',
                        'dist/**',
                    ],
                    testTimeout: 30_000,
                    hookTimeout: 30_000,
                },
            },
        ],
    },
});
