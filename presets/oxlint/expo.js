import { resolve } from 'node:path';
import { defineConfig } from 'oxlint';

import base from './base.js';

const pluginPath = resolve(import.meta.dirname, 'plugins/codestyle.js');

export default defineConfig({
    extends: [base],
    plugins: ['typescript', 'import', 'react'],
    jsPlugins: [pluginPath],
    rules: {
        'typescript/no-require-imports': [
            'error',
            {
                allow: [
                    String.raw`\.png$`,
                    String.raw`\.jpg$`,
                    String.raw`\.jpeg$`,
                    String.raw`\.gif$`,
                    String.raw`\.webp$`,
                ],
            },
        ],
        'codestyle/imports-without-ext': 'error',
        'react/react-in-jsx-scope': 'off',
        'react/jsx-props-no-spreading': 'off',
        'react/jsx-boolean-value': 'off',
        'react/jsx-handler-names': 'off',
        'react/jsx-curly-brace-presence': 'off',
        'unicorn/no-nested-ternary': 'off',
    },
});
