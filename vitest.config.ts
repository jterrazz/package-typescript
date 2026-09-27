import { cli, defineSpecConfig, lint, unit } from '@jterrazz/test/vitest';
import { resolve } from 'node:path';
import { mergeConfig } from 'vitest/config';

const TOOLCHAIN_BUDGET_MS = 120_000;

export default defineSpecConfig({
    test: {
        projects: [
            // The default set excludes `specs/` whole. No module test mocks a module or writes a global, so `isolate: false`.
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
            lint(),
            mergeConfig(cli({ timeout: TOOLCHAIN_BUDGET_MS }), {
                test: {
                    globalSetup: [
                        resolve(import.meta.dirname, 'specs/cli/_setup/run-temp-root.ts'),
                    ],
                },
            }),
        ],
    },
});
