import { allOn, fragment, off, on } from '../_contract.js';

/*
 * The `import` plugin, all 31 non-nursery rules decided by name.
 *
 * `import/extensions` is the one rule two platforms answer differently: Node
 * ESM resolves a specifier literally and needs the `.js`, a bundler resolves it
 * and refuses one. Core states the Node answer; `rules/next.js`,
 * `rules/astro.js`, `rules/react-native.js` and `rules/bundler.js` re-decide it
 * for their platform, at `error` either way — a profile changes the convention,
 * never the level.
 *
 * `import/no-cycle` rides here for +0.05s. Mind what it does NOT see: oxlint's
 * implementation ignores type-only imports, so a value import one way and an
 * `import type` back is invisible to it (oxc#20551).
 */

/** Asset specifiers keep their extension on every platform — a bundler resolves them by it. */
export const ASSETS = {
    avif: 'always',
    css: 'always',
    gif: 'always',
    jpeg: 'always',
    jpg: 'always',
    json: 'always',
    less: 'always',
    png: 'always',
    sass: 'always',
    scss: 'always',
    svg: 'always',
    webp: 'always',
};

export const EXTENSIONS_ALWAYS = on(['always', { ignorePackages: true, ...ASSETS }]);
export const EXTENSIONS_NEVER = on(['never', ASSETS]);

export default fragment({
    id: 'core/import',
    plugins: ['import'],
    rules: {
        ...allOn(
            [
                'default',
                'first',
                'namespace',
                'newline-after-import',
                'no-absolute-path',
                'no-amd',
                'no-commonjs',
                'no-cycle',
                'no-duplicates',
                'no-dynamic-require',
                'no-empty-named-blocks',
                'no-mutable-exports',
                'no-named-as-default',
                'no-named-as-default-member',
                'no-named-default',
                'no-namespace',
                'no-self-import',
                'no-unassigned-import',
                'no-webpack-loader-syntax',
            ].map((rule) => `import/${rule}`),
        ),

        // -- On, at the strictest value the option carries ---------------------
        /*
         * Top level, not inline, and `verbatimModuleSyntax` is why: under it
         * `import { type X } from 'leaflet'` is emitted as
         * `import {} from 'leaflet'` — a runtime side-effect import of a module
         * that may only exist in a browser. signews-web served a 500 from it.
         */
        'import/consistent-type-specifier-style': on(['prefer-top-level']),
        'import/extensions': EXTENSIONS_ALWAYS,

        // -- Off, each with its one reason -------------------------------------
        'import/exports-last': off({
            by: 'docs/07-lint-presets.md — an export sits with the declaration it exports; three repositories had refused this rule locally before the decision moved here',
            kind: 'convention',
        }),
        'import/group-exports': off({
            by: 'docs/07-lint-presets.md — an export sits with the declaration it exports',
            kind: 'convention',
        }),
        'import/max-dependencies': off({
            by: 'oxc/no-barrel-file — the defect a dependency count stands in for is the barrel, and that rule names it',
            kind: 'covered',
        }),
        'import/no-anonymous-default-export': off({
            by: 'unicorn/no-anonymous-default-export',
            kind: 'covered',
        }),
        'import/no-default-export': off({
            by: 'docs/07-lint-presets.md — every framework config file and every preset of this package is a default export',
            kind: 'convention',
        }),
        'import/no-named-export': off({
            by: 'docs/07-lint-presets.md — a module exports what it owns by name',
            kind: 'convention',
        }),
        'import/no-nodejs-modules': off({
            by: 'docs/07-lint-presets.md — the estate ships Node services, and a browser boundary is the profile that states it',
            kind: 'convention',
        }),
        'import/no-relative-parent-imports': off({
            by: 'docs/07-lint-presets.md — a relative parent import is how a package reaches its own sibling module; layer boundaries are the layer map, not the path shape',
            kind: 'convention',
        }),
        'import/prefer-default-export': off({
            by: 'docs/07-lint-presets.md — a module exports what it owns by name',
            kind: 'convention',
        }),
        'import/unambiguous': off({
            by: 'TypeScript — `verbatimModuleSyntax` and a package\'s `"type": "module"` already make every file a module, and what the rule reports beyond that is a file with nothing to export: an entry script, an Astro `is:inline` block',
            kind: 'covered',
        }),
    },
});
