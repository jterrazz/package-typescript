import {
    allOn,
    fragment,
    off,
    on,
    scoped,
    typeAware,
    unsafeFix,
} from '../../kit/compiler/decision.js';
import type { Stated } from '../../kit/compiler/decision.js';

// invariant: every rule tsgolint runs is decided, nursery included, so a tsgolint release never adds an unnamed check.

const NURSERY_SINCE = '11.0.0';

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
].map((rule): [string, Stated] => [`typescript/${rule}`, off(UNTYPED_BY_CONSTRUCTION)]);

export default fragment({
    id: 'typescript',
    audience: 'consumer',
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

        ...Object.fromEntries(
            [
                'await-thenable',
                'consistent-type-exports',
                'dot-notation',
                'no-array-delete',
                'no-base-to-string',
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
                'only-throw-error',
                'prefer-find',
                'prefer-includes',
                'prefer-promise-reject-errors',
                'prefer-readonly',
                'prefer-reduce-type-parameter',
                'prefer-regexp-exec',
                'prefer-return-this-type',
                'prefer-string-starts-ends-with',
                'related-getter-setter-pairs',
                'require-array-sort-compare',
                'restrict-plus-operands',
                'restrict-template-expressions',
                'strict-boolean-expressions',
                'strict-void-return',
                'unbound-method',
                'use-unknown-in-catch-callback-variable',
            ].map((rule) => [`typescript/${rule}`, typeAware()]),
        ),

        'typescript/array-type': on([{ default: 'array' }]),
        'typescript/ban-ts-comment': on([
            {
                'ts-check': false,
                'ts-expect-error': 'allow-with-description',
                'ts-ignore': true,
                'ts-nocheck': true,
            },
        ]),
        'typescript/require-await': off(
            {
                by: "rule review, 2026-10-03 — 11 reports held and 92 `await Promise.resolve()` lines written only to quiet it on package-test and package-typescript: `promise-function-async` makes every promise-returning function async, so a synchronous implementation of an async port has nothing to await; a forgotten await is `no-floating-promises`'s and `await-thenable`'s",
                kind: 'evidence',
            },
            '11.0.0',
        ),
        'typescript/consistent-type-definitions': off(
            {
                by: 'rule review, 2026-10-03 — 0 reports held and 32 suppressions on package-test and package-typescript, every one a place the language needs an interface (a `this`-typed member, a module augmentation, a declaration merge); one spelling prevents no defect',
                kind: 'evidence',
            },
            '11.0.0',
        ),
        'typescript/no-confusing-void-expression': unsafeFix(
            typeAware(),
            'wraps a returned promise, after which nothing awaits it',
        ),
        'typescript/promise-function-async': unsafeFix(
            typeAware(),
            'wraps a function that hands out an existing promise in `async … await`, so the caller receives a fresh promise nobody has claimed',
        ),
        'typescript/no-unnecessary-type-assertion': unsafeFix(
            typeAware(),
            'drops a cast a widened platform type needs',
        ),
        // hazard: for `import/consistent-type-specifier-style`'s reason: an inline type specifier survives as an empty import.
        'typescript/consistent-type-imports': on([
            {
                disallowTypeAnnotations: true,
                fixStyle: 'separate-type-imports',
                prefer: 'type-imports',
            },
        ]),
        'typescript/no-import-type-side-effects': on(),
        'typescript/explicit-member-accessibility': on([{ accessibility: 'no-public' }]),
        // hazard: booleans excepted: `false ?? x` is `false` and `false || x` is `x`.
        'typescript/prefer-nullish-coalescing': typeAware([
            { ignorePrimitives: { boolean: true } },
        ]),
        'typescript/method-signature-style': on(['property']),
        // outside: nursery upstream, decided because tsgolint runs it.
        'typescript/prefer-optional-chain': { ...typeAware(), since: NURSERY_SINCE },
        'typescript/return-await': typeAware(['always']),
        'typescript/switch-exhaustiveness-check': {
            ...typeAware([
                { considerDefaultExhaustiveForUnions: true, requireDefaultForNonUnion: true },
            ]),
            since: '11.0.0',
        },

        'typescript/ban-types': off({
            by: 'typescript/no-empty-object-type, no-unsafe-function-type, no-wrapper-object-types — its three successors',
            kind: 'covered',
        }),
        'typescript/consistent-return': off(
            {
                by: 'TypeScript noImplicitReturns — set in every tsconfig preset, it refuses a path that falls off a function whose other paths return a value, and reads what the rule cannot: an exhaustive switch, and a return type that holds `void`; the rule refused both, and asked a React effect returning its cleanup on one path for the `return undefined` unicorn/no-useless-undefined refuses (jterrazz-web pilot, 2026-10-06)',
                kind: 'covered',
            },
            '11.0.0',
        ),
        'typescript/explicit-function-return-type': off({
            by: 'TypeScript — the build emits every published declaration with the type-checker, which refuses an inferred type it cannot name (TS2742, TS4058)',
            kind: 'covered',
        }),
        'typescript/explicit-module-boundary-types': off({
            by: 'TypeScript — the build emits every published declaration with the type-checker, which refuses an inferred type it cannot name (TS2742, TS4058)',
            kind: 'covered',
        }),
        'typescript/no-empty-interface': off({
            by: 'typescript/no-empty-object-type — its upstream successor',
            kind: 'covered',
        }),
        'typescript/non-nullable-type-assertion-style': off({
            by: 'typescript/no-non-null-assertion — its fix is the `!` assertion that rule forbids, so no edit closes both',
            kind: 'exclusive',
        }),
        'typescript/no-unnecessary-condition': off(
            {
                by: 'measured on this package — 8 reports, not one a defect: a `while (true)` loop, a flag read off parsed JSON, and `?? ""` guards on the `spawnSync` streams @types/node types non-null and Node leaves null when the spawn fails',
                kind: 'evidence',
            },
            NURSERY_SINCE,
        ),
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
