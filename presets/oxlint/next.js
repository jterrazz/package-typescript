import { resolve } from 'node:path';
import { defineConfig } from 'oxlint';

import base from './base.js';

const pluginPath = resolve(import.meta.dirname, 'plugins/codestyle.js');

export default defineConfig({
    extends: [base],
    plugins: ['typescript', 'import', 'react', 'nextjs'],
    jsPlugins: [pluginPath],
    // `public/` is Next's static dir and `assets/` is the stack's convention
    // For content trees (jterrazz-web: signed attestation bytes live there —
    // A formatter pass would invalidate every proof). Neither is source.
    ignorePatterns: [
        'dist/**',
        'node_modules/**',
        '.next/**',
        'next-env.d.ts',
        'assets/**',
        'public/**',
    ],
    rules: {
        'codestyle/imports-without-ext': 'error',
        'react/react-in-jsx-scope': 'off',
        'react/jsx-props-no-spreading': 'off',
        'react/jsx-boolean-value': 'off',
        'react/jsx-handler-names': 'off',
        'react/jsx-curly-brace-presence': 'off',
        'react/jsx-max-depth': 'off',
        'unicorn/no-nested-ternary': 'off',
        // -- Rules that fight the Next idiom itself, not bad code --
        // (import/exports-last is off in base: it fights the whole ecosystem.)
        // Immutable serialization maps (`.map((x) => ({ ...x, url }))`) are
        // The dominant React idiom; the Object.assign form is strictly worse
        // For the build-time collection sizes a site actually maps over.
        'oxc/no-map-spread': 'off',
        // Client components are browser-only code that means `window`;
        // Asking them to say `globalThis` trades clarity for portability
        // They will never need.
        'unicorn/prefer-global-this': 'off',
    },
});
