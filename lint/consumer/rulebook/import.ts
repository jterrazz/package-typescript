import { allOn, fragment, off, on } from '../../kit/compiler/decision.js';

// outside: `import/extensions` is re-decided per platform (next, astro, react-native, bundler), always at `error`.
// `import/no-cycle` ignores type-only imports, so a value edge one way and a type edge back is invisible (oxc#20551).

// outside: a bundler resolves an asset by its extension, on every platform.
export const IMPORT_ASSETS = {
    avif: 'always',
    css: 'always',
    eot: 'always',
    gif: 'always',
    jpeg: 'always',
    jpg: 'always',
    json: 'always',
    less: 'always',
    otf: 'always',
    png: 'always',
    sass: 'always',
    scss: 'always',
    svg: 'always',
    ttf: 'always',
    webp: 'always',
    woff: 'always',
    woff2: 'always',
};

// outside: a module imported for what loading it does is named so by its package: `<package>/register` registers a hook, `dotenv/config` loads a .env file.
// Stryker disable ArrayDeclaration,StringLiteral: oxlint reads the rulebook in a process of its own, which no mutant reaches; the behaviour grounds of specs/cli/preset/ prove each name
export const IMPORT_SIDE_EFFECT_MODULES: readonly string[] = Object.freeze([
    '**/register',
    'dotenv/config',
]);
// Stryker restore ArrayDeclaration,StringLiteral

const IMPORT_EXTENSIONS_ALWAYS = on(['always', { ignorePackages: true, ...IMPORT_ASSETS }]);
// outside: a package with no `exports` map resolves a subpath only by its file name (`expo/metro-config.js`), so how a package's subpath is spelled is the package's, never the project's.
const PACKAGE_SUBPATH = '{[a-z]*,@[a-z]*/*}/**';

export const IMPORT_EXTENSIONS_NEVER = on([
    'never',
    { ...IMPORT_ASSETS, pathGroupOverrides: [{ action: 'ignore', pattern: PACKAGE_SUBPATH }] },
]);

export default fragment({
    id: 'import',
    audience: 'consumer',
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
                'no-webpack-loader-syntax',
            ].map((rule) => `import/${rule}`),
        ),

        // hazard: under `verbatimModuleSyntax`, `import { type X } from 'leaflet'` emits a runtime `import {} from 'leaflet'`.
        'import/consistent-type-specifier-style': on(['prefer-top-level']),
        'import/extensions': IMPORT_EXTENSIONS_ALWAYS,
        'import/no-unassigned-import': {
            // Stryker disable next-line ArrayDeclaration,ObjectLiteral: oxlint reads the rulebook in a process of its own, which no mutant reaches; the behaviour grounds of specs/cli/preset/ prove each name
            ...on([{ allow: [...IMPORT_SIDE_EFFECT_MODULES] }]),
            since: '11.0.0',
        },

        'import/exports-last': off({
            by: 'docs/reference/lint-presets.md — an export sits with the declaration it exports; three repositories had refused this rule locally before the decision moved here',
            kind: 'convention',
        }),
        'import/group-exports': off({
            by: 'docs/reference/lint-presets.md — an export sits with the declaration it exports',
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
            by: 'docs/reference/lint-presets.md — every framework config file and every preset of this package is a default export',
            kind: 'convention',
        }),
        'import/no-named-export': off({
            by: 'docs/reference/lint-presets.md — a module exports what it owns by name',
            kind: 'convention',
        }),
        'import/no-nodejs-modules': off({
            by: 'docs/reference/lint-presets.md — the estate ships Node services, and a browser boundary is the profile that states it',
            kind: 'convention',
        }),
        'import/no-relative-parent-imports': off({
            by: 'docs/reference/lint-presets.md — a relative parent import is how a package reaches its own sibling module; layer boundaries are the layer map, not the path shape',
            kind: 'convention',
        }),
        'import/prefer-default-export': off({
            by: 'docs/reference/lint-presets.md — a module exports what it owns by name',
            kind: 'convention',
        }),
        'import/unambiguous': off({
            by: 'TypeScript — `verbatimModuleSyntax` and a package\'s `"type": "module"` already make every file a module, and what the rule reports beyond that is a file with nothing to export: an entry script, an Astro `is:inline` block',
            kind: 'covered',
        }),
    },
});
