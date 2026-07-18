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
                test: {
                    name: 'e2e',
                    include: ['specs/**/*.test.ts'],
                    exclude: [
                        'specs/cli/preset/exports.test.ts',
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
