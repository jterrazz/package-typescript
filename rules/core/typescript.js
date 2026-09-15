import { allOn, fragment, off, on, scoped, typeAware } from '../_contract.js';

/*
 * The `typescript` plugin, all 108 non-nursery rules decided by name. Fifty-one
 * of them need type information: they run because every profile ships
 * `options.typeAware`, which `oxlint-tsgolint` answers (it embeds its own
 * TypeScript, so a consumer is not forced onto TypeScript 7 to get them).
 */
/*
 * A JavaScript file has no parameter types. Every value flowing through one is
 * `any` by construction, so the unsafe-any family reports the LANGUAGE, not a
 * defect — measured on this package's own tree, 530 reports of which not one
 * named a bug. The family stays armed everywhere TypeScript types the code.
 */
const UNTYPED_BY_CONSTRUCTION = {
    by: 'TypeScript — a .js file has no parameter types, so every value in it is `any` and the rule reports the language, not a defect',
    kind: 'covered',
};

const UNTYPED_IN_JAVASCRIPT = [
    'no-unsafe-argument',
    'no-unsafe-assignment',
    'no-unsafe-call',
    'no-unsafe-enum-comparison',
    'no-unsafe-member-access',
    'no-unsafe-return',
    'no-unsafe-type-assertion',
    'no-unsafe-unary-minus',
    'strict-boolean-expressions',
].map((rule) => [`typescript/${rule}`, off(UNTYPED_BY_CONSTRUCTION)]);

export default fragment({
    id: 'core/typescript',
    plugins: ['typescript'],
    overrides: [
        scoped({
            files: ['**/*.js', '**/*.cjs', '**/*.mjs'],
            rules: Object.fromEntries(UNTYPED_IN_JAVASCRIPT),
        }),
    ],
    rules: {
        ...allOn(
            [
                'adjacent-overload-signatures',
                'ban-tslint-comment',
                'class-literal-property-style',
                'consistent-generic-constructors',
                'consistent-indexed-object-style',
                'consistent-type-assertions',
                'no-confusing-non-null-assertion',
                'no-duplicate-enum-values',
                'no-dynamic-delete',
                'no-empty-object-type',
                'no-explicit-any',
                'no-extra-non-null-assertion',
                'no-extraneous-class',
                'no-inferrable-types',
                'no-invalid-void-type',
                'no-misused-new',
                'no-namespace',
                'no-non-null-asserted-nullish-coalescing',
                'no-non-null-asserted-optional-chain',
                'no-non-null-assertion',
                'no-require-imports',
                'no-restricted-types',
                'no-this-alias',
                'no-unnecessary-parameter-property-assignment',
                'no-unnecessary-type-constraint',
                'no-unsafe-declaration-merging',
                'no-unsafe-function-type',
                'no-useless-empty-export',
                'no-wrapper-object-types',
                'parameter-properties',
                'prefer-as-const',
                'prefer-enum-initializers',
                'prefer-for-of',
                'prefer-function-type',
                'prefer-literal-enum-member',
                'prefer-namespace-keyword',
                'prefer-ts-expect-error',
                'triple-slash-reference',
                'unified-signatures',
            ].map((rule) => `typescript/${rule}`),
        ),

        // -- On, and type-aware ----------------------------------------------
        ...Object.fromEntries(
            [
                'await-thenable',
                'consistent-return',
                'consistent-type-exports',
                'dot-notation',
                'no-array-delete',
                'no-base-to-string',
                'no-confusing-void-expression',
                'no-deprecated',
                'no-duplicate-type-constituents',
                'no-floating-promises',
                'no-for-in-array',
                'no-implied-eval',
                'no-meaningless-void-operator',
                'no-misused-promises',
                'no-misused-spread',
                'no-mixed-enums',
                'no-redundant-type-constituents',
                'no-unnecessary-boolean-literal-compare',
                'no-unnecessary-qualifier',
                'no-unnecessary-template-expression',
                'no-unnecessary-type-arguments',
                'no-unnecessary-type-assertion',
                'no-unnecessary-type-conversion',
                'no-unnecessary-type-parameters',
                'no-unsafe-argument',
                'no-unsafe-assignment',
                'no-unsafe-call',
                'no-unsafe-enum-comparison',
                'no-unsafe-member-access',
                'no-unsafe-return',
                'no-unsafe-type-assertion',
                'no-unsafe-unary-minus',
                'no-useless-default-assignment',
                'non-nullable-type-assertion-style',
                'only-throw-error',
                'prefer-find',
                'prefer-includes',
                'prefer-promise-reject-errors',
                'prefer-readonly',
                'prefer-reduce-type-parameter',
                'prefer-regexp-exec',
                'prefer-return-this-type',
                'prefer-string-starts-ends-with',
                'promise-function-async',
                'related-getter-setter-pairs',
                'require-array-sort-compare',
                'require-await',
                'restrict-plus-operands',
                'restrict-template-expressions',
                'strict-boolean-expressions',
                'strict-void-return',
                'switch-exhaustiveness-check',
                'unbound-method',
                'use-unknown-in-catch-callback-variable',
            ].map((rule) => [`typescript/${rule}`, typeAware()]),
        ),

        // -- On, at the strictest value the option carries ---------------------
        'typescript/array-type': on([{ default: 'array' }]),
        'typescript/ban-ts-comment': on([
            {
                'ts-check': false,
                'ts-expect-error': 'allow-with-description',
                'ts-ignore': true,
                'ts-nocheck': true,
            },
        ]),
        'typescript/consistent-type-definitions': on(['type']),
        'typescript/consistent-type-imports': on([
            {
                disallowTypeAnnotations: true,
                fixStyle: 'inline-type-imports',
                prefer: 'type-imports',
            },
        ]),
        'typescript/explicit-member-accessibility': on([{ accessibility: 'no-public' }]),
        /* Booleans excepted: `false ?? x` is `false` and `false || x` is `x`,
         * so on a boolean the two operators mean different things and the
         * rewrite the rule asks for is not the same expression. */
        'typescript/prefer-nullish-coalescing': typeAware([
            { ignorePrimitives: { boolean: true } },
        ]),
        'typescript/method-signature-style': on(['property']),
        'typescript/return-await': typeAware(['always']),

        // -- Off, each with its one reason -------------------------------------
        'typescript/ban-types': off({
            by: 'typescript/no-empty-object-type, no-unsafe-function-type, no-wrapper-object-types — its three successors',
            kind: 'covered',
        }),
        'typescript/explicit-function-return-type': off({
            by: 'presets/tsconfig/library.json — isolatedDeclarations requires the annotation exactly where it is load-bearing',
            kind: 'covered',
        }),
        'typescript/explicit-module-boundary-types': off({
            by: 'presets/tsconfig/library.json — isolatedDeclarations requires the annotation exactly where it is load-bearing',
            kind: 'covered',
        }),
        'typescript/no-import-type-side-effects': off({
            by: 'import/consistent-type-specifier-style (prefer-inline) — an import whose specifiers are all inline types is exactly the form that rule asks for',
            kind: 'exclusive',
        }),
        'typescript/no-empty-interface': off({
            by: 'typescript/no-empty-object-type — its upstream successor',
            kind: 'covered',
        }),
        'typescript/no-var-requires': off({
            by: 'typescript/no-require-imports — its upstream successor',
            kind: 'covered',
        }),
        'typescript/prefer-readonly-parameter-types': off({
            by: 'no-param-reassign, typescript/prefer-readonly — the defect is mutation, and both name it',
            kind: 'covered',
        }),
    },
});
