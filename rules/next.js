import { allOn, fragment, off, on, scoped } from './_contract.js';
import { EXTENSIONS_NEVER } from './core/import.js';

/*
 * The `nextjs` plugin, all 21 rules on, plus the two decisions Next's own
 * resolution forces: a bundler resolves an import, so a specifier carries no
 * extension, and `next-env.d.ts` is a side-effect import Next writes itself.
 */
export default fragment({
    id: 'next',
    plugins: ['nextjs'],
    ignorePatterns: ['.next/**', 'next-env.d.ts', 'assets/**', 'public/**'],
    overrides: [
        scoped({
            files: ['**/next-env.d.ts'],
            rules: {
                'import/no-unassigned-import': off({
                    by: 'Next writes this file, and its whole body is a triple-slash reference',
                    kind: 'convention',
                }),
            },
        }),
    ],
    rules: {
        ...allOn(
            [
                'google-font-display',
                'google-font-preconnect',
                'inline-script-id',
                'next-script-for-ga',
                'no-assign-module-variable',
                'no-async-client-component',
                'no-before-interactive-script-outside-document',
                'no-css-tags',
                'no-document-import-in-page',
                'no-duplicate-head',
                'no-head-element',
                'no-head-import-in-document',
                'no-html-link-for-pages',
                'no-img-element',
                'no-page-custom-font',
                'no-script-component-in-head',
                'no-styled-jsx-in-document',
                'no-sync-scripts',
                'no-title-in-document-head',
                'no-typos',
                'no-unwanted-polyfillio',
            ].map((rule) => `nextjs/${rule}`),
        ),

        'import/extensions': EXTENSIONS_NEVER,

        /*
         * A stylesheet import IS its own assignment — `import './global.css'`
         * in a root layout is how a Next tree carries its styles, and there is
         * nothing to bind it to. The option list is restated whole, options
         * replacing.
         */
        'import/no-unassigned-import': on([{ allow: ['**/*.css', '**/*.scss'] }]),
    },
});
