import { defineConfig } from '@jterrazz/typescript/config';

export default defineConfig({
    kind: 'api',
    platform: 'node',
    typescript: {
        oxlint: {
            rules: {
                'no-debugger': { level: 'off', reason: 'the pause is the point of this module' },
            },
        },
    },
});
