import { resolve } from 'node:path';
import { defineConfig } from 'oxlint';

import base from './base.js';

const pluginPath = resolve(import.meta.dirname, 'plugins/codestyle.js');

export default defineConfig({
    extends: [base],
    plugins: ['typescript', 'import', 'react', 'nextjs'],
    jsPlugins: [pluginPath],
    ignorePatterns: ['dist/**', 'node_modules/**', '.next/**', 'next-env.d.ts'],
    rules: {
        'codestyle/imports-without-ext': 'error',
    },
});
