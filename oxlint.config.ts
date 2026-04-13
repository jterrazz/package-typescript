import { defineConfig } from 'oxlint';

import base from './presets/oxlint/base.js';

export default defineConfig({
    extends: [base],
    ignorePatterns: [
        'dist',
        'node_modules',
        '**/invalid',
        '**/valid',
        '**/inputs',
        '**/expected',
        '**/hexagonal',
    ],
});
