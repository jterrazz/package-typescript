import { allOn, fragment, off, on } from './_contract.js';

/*
 * The `react` and `react-perf` plugins, all 88 non-nursery rules decided by
 * name — the hooks rules, the React Compiler rules (purity, immutability,
 * static-components, preserve-manual-memoization…) and the class-era
 * correctness rules alike.
 */
export default fragment({
    id: 'react',
    plugins: ['react', 'react-perf'],
    rules: {
        ...allOn(
            [
                'button-has-type',
                'capitalized-calls',
                'checked-requires-onchange-or-readonly',
                'display-name',
                'error-boundaries',
                'exhaustive-deps',
                'exhaustive-effect-dependencies',
                'forbid-dom-props',
                'forbid-elements',
                'forward-ref-uses-ref',
                'globals',
                'hook-use-state',
                'hooks',
                'iframe-missing-sandbox',
                'immutability',
                'incompatible-library',
                'invariant',
                'jsx-boolean-value',
                'jsx-curly-brace-presence',
                'jsx-fragments',
                'jsx-handler-names',
                'jsx-key',
                'jsx-no-comment-textnodes',
                'jsx-no-constructed-context-values',
                'jsx-no-duplicate-props',
                'jsx-no-script-url',
                'jsx-no-target-blank',
                'jsx-no-undef',
                'jsx-no-useless-fragment',
                'jsx-pascal-case',
                'jsx-props-no-spread-multi',
                'memo-dependencies',
                'no-array-index-key',
                'no-children-prop',
                'no-clone-element',
                'no-danger',
                'no-danger-with-children',
                'no-deriving-state-in-effects',
                'no-did-mount-set-state',
                'no-did-update-set-state',
                'no-direct-mutation-state',
                'no-find-dom-node',
                'no-is-mounted',
                'no-namespace',
                'no-object-type-as-default-prop',
                'no-react-children',
                'no-redundant-should-component-update',
                'no-render-return-value',
                'no-set-state',
                'no-string-refs',
                'no-this-in-sfc',
                'no-unescaped-entities',
                'no-unsafe',
                'no-unstable-nested-components',
                'no-will-update-set-state',
                'prefer-es6-class',
                'prefer-function-component',
                'preserve-manual-memoization',
                'purity',
                'refs',
                'rule-suppression',
                'rules-of-hooks',
                'self-closing-comp',
                'set-state-in-effect',
                'set-state-in-render',
                'state-in-constructor',
                'static-components',
                'style-prop-object',
                'syntax',
                'todo',
                'unsupported-syntax',
                'use-memo',
                'void-dom-elements-no-children',
                'void-use-memo',
            ].map((rule) => `react/${rule}`),
        ),

        // -- On, at the value the estate's own shape asks for -------------------
        'react/function-component-definition': on([
            { namedComponents: 'function-declaration', unnamedComponents: 'arrow-function' },
        ]),
        'react/jsx-filename-extension': on([{ extensions: ['.jsx', '.tsx'] }]),

        // -- Off, each with its one reason -------------------------------------
        'react-perf/jsx-no-jsx-as-prop': off({
            by: 'react/static-components, react/use-memo — the React Compiler rules decide memoisation, and an inline prop is the idiom they are written for',
            kind: 'covered',
        }),
        'react-perf/jsx-no-new-array-as-prop': off({
            by: 'react/static-components, react/use-memo — the React Compiler rules decide memoisation, and an inline prop is the idiom they are written for',
            kind: 'covered',
        }),
        'react-perf/jsx-no-new-function-as-prop': off({
            by: 'react/static-components, react/use-memo — the React Compiler rules decide memoisation, and an inline prop is the idiom they are written for',
            kind: 'covered',
        }),
        'react-perf/jsx-no-new-object-as-prop': off({
            by: 'react/static-components, react/use-memo — the React Compiler rules decide memoisation, and an inline prop is the idiom they are written for',
            kind: 'covered',
        }),
        'react/forbid-component-props': off({
            by: 'docs/07-lint-presets.md — className is how a component takes its styling, and the rule forbids it by default',
            kind: 'convention',
        }),
        'react/jsx-max-depth': off({
            by: 'max-depth (4) — nesting depth is one property, and one rule owns it',
            kind: 'covered',
        }),
        'react/jsx-no-literals': off({
            by: 'docs/07-lint-presets.md — the estate has no translation-extraction convention that would need every string hoisted',
            kind: 'convention',
        }),
        'react/jsx-props-no-spreading': off({
            by: 'docs/07-lint-presets.md — a wrapper component forwards its props by spread',
            kind: 'convention',
        }),
        'react/no-multi-comp': off({
            by: 'docs/07-lint-presets.md — a file holds a component and the small private pieces only it uses',
            kind: 'convention',
        }),
        'react/no-unknown-property': off({
            by: 'TypeScript — a JSX attribute is checked against the element props type, which knows the framework attributes this rule does not',
            kind: 'covered',
        }),
        'react/only-export-components': off({
            by: 'docs/07-lint-presets.md — a Next route file exports its metadata beside its component',
            kind: 'convention',
        }),
        'react/react-in-jsx-scope': off({
            by: 'presets/tsconfig/next.json — the automatic JSX runtime (jsx: react-jsx) imports it',
            kind: 'covered',
        }),

        /*
         * A stylesheet import IS its own assignment — `import './index.css'`
         * is how a React tree carries its styles, whatever bundles it, and
         * there is nothing to bind it to. One owner for every React profile.
         */
        'import/no-unassigned-import': on([{ allow: ['**/*.css', '**/*.scss'] }]),
    },
});
