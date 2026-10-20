import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: { projects: [{ test: { include: ['specs/**/*.spec.ts'], name: 'cli' } }] },
});
