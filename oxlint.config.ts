import { defineConfig } from 'oxlint';

import base from './presets/oxlint/base.js';

export default defineConfig({
    extends: [base],
    ignorePatterns: [
        'dist',
        'node_modules',
        '**/fixtures/**',
        '**/invalid',
        '**/valid',
        '**/inputs',
        '**/expected',
        '**/hexagonal',
    ],
});
