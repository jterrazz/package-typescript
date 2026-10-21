import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        projects: [
            { test: { fileParallelism: false, include: ['specs/**/*.spec.ts'], name: 'serial' } },
        ],
    },
});
