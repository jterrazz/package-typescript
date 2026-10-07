import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: { projects: [{ test: { include: ['src/**/*.test.ts'], name: 'unit' } }] },
});
