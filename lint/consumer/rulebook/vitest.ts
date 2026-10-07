import { allOn, fragment, off, on, scoped, unsafeFix } from '../../kit/compiler/decision.js';

// invariant: four offs are one half of an exclusive pair; `exclusive-pairs.test.ts` proves no profile arms both.

// invariant: a file another runner owns takes that runner's suffix (`*.e2e.ts`, `*.render.tsx`), which no glob here names.
const TEST_FILES = Object.freeze([
    '**/*.{test,spec,test-d,spec-d}.{ts,tsx,js,jsx}',
    '**/specs/**/*.{ts,tsx}',
    '**/__tests__/**/*.{ts,tsx,js,jsx}',
]);

// outside: ADR-008 gave `@jterrazz/test`'s `test()` preset three more, with their options.
const ON_IN_TESTS = [
    'consistent-each-for',
    'consistent-vitest-vi',
    'expect-expect',
    'hoisted-apis-on-top',
    'max-expects',
    'no-alias-methods',
    'no-commented-out-tests',
    'no-conditional-expect',
    'no-conditional-tests',
    'no-disabled-tests',
    'no-duplicate-hooks',
    'no-focused-tests',
    'no-identical-title',
    'no-import-node-test',
    'no-interpolation-in-snapshots',
    'no-large-snapshots',
    'no-mocks-import',
    'no-standalone-expect',
    'no-test-prefixes',
    'no-test-return-statement',
    'no-unneeded-async-expect-function',
    'padding-around-after-all-blocks',
    'padding-around-test-blocks',
    'prefer-called-exactly-once-with',
    'prefer-called-once',
    'prefer-comparison-matcher',
    'prefer-each',
    'prefer-equality-matcher',
    'prefer-expect-resolves',
    'prefer-expect-type-of',
    'prefer-hooks-in-order',
    'prefer-hooks-on-top',
    'prefer-importing-vitest-globals',
    'prefer-mock-promise-shorthand',
    'prefer-mock-return-shorthand',
    'prefer-snapshot-hint',
    'prefer-spy-on',
    'prefer-strict-equal',
    'prefer-to-be',
    'prefer-to-be-object',
    'prefer-to-contain',
    'prefer-to-have-been-called-times',
    'prefer-to-have-length',
    'prefer-todo',
    'require-awaited-expect-poll',
    'require-local-test-context-for-concurrent-snapshots',
    'require-to-throw-message',
    'valid-describe-callback',
    'valid-expect',
    'valid-expect-in-promise',
    'valid-title',
    'warn-todo',
].map((rule) => `vitest/${rule}`);

const CONSISTENT_TEST_IT = unsafeFix(
    on([{ fn: 'test' }]),
    'rewrites `it(` into `test(` and leaves `import { it }` behind',
);
const PREFER_LOWERCASE_TITLE = unsafeFix(
    on(),
    'lower-cases the first character blindly: `CLI …` becomes `cLI …`',
);
const PREFER_IMPORT_IN_MOCK = unsafeFix(
    on(),
    "rewrites `vi.mock('x', f)` into `vi.mock(import('x'), f)`, after which the factory owes the module's full type",
);
const PREFER_STRICT_BOOLEAN_MATCHERS = unsafeFix(
    on(),
    'rewrites `toBeTruthy()` into `toBe(true)` whatever the subject is — an element, a string — which is never `true`',
);
const PREFER_CALLED_WITH = unsafeFix(
    on(),
    'rewrites `toHaveBeenCalled()` into `toHaveBeenCalledWith()`, an assertion of NO arguments',
);

// outside: a floor under the `test()` preset (`file-suffix-matches-place`, ADR-008).
const CONSISTENT_TEST_FILENAME = on([{ pattern: String.raw`.*\.(spec|test)\.[tj]sx?$` }]);

const COVERED_BY_TESTING = { by: '@jterrazz/test testing', kind: 'covered' };

export default fragment({
    id: 'vitest',
    audience: 'consumer',
    plugins: ['vitest'],
    overrides: [
        scoped({
            files: [...TEST_FILES],
            rules: {
                ...allOn(ON_IN_TESTS),

                'vitest/consistent-test-filename': CONSISTENT_TEST_FILENAME,
                'vitest/consistent-test-it': CONSISTENT_TEST_IT,
                'vitest/prefer-lowercase-title': PREFER_LOWERCASE_TITLE,
                'vitest/prefer-import-in-mock': PREFER_IMPORT_IN_MOCK,
                'vitest/require-mock-type-parameters': on(),
                'vitest/prefer-strict-boolean-matchers': PREFER_STRICT_BOOLEAN_MATCHERS,
                'vitest/prefer-called-with': PREFER_CALLED_WITH,

                // outside: ADR-008: two owners of one rule's options is a config that depends on composition order.
                'vitest/max-nested-describe': off(COVERED_BY_TESTING, '10.3.0'),
                'vitest/no-restricted-matchers': off(COVERED_BY_TESTING, '10.3.0'),
                'vitest/no-restricted-vi-methods': off(COVERED_BY_TESTING, '10.3.0'),

                'vitest/no-conditional-in-test': off({
                    by: "vitest/no-conditional-expect — the defect is an assertion that may not run, and that rule names it; this one also refuses a golden suite's TEST_UPDATE branch and every comparator",
                    kind: 'covered',
                }),
                'vitest/no-hooks': off({
                    by: 'vitest/prefer-hooks-in-order, vitest/prefer-hooks-on-top — both describe where a hook goes',
                    kind: 'exclusive',
                }),
                'vitest/no-importing-vitest-globals': off({
                    by: 'vitest/prefer-importing-vitest-globals',
                    kind: 'exclusive',
                }),
                'vitest/prefer-called-times': off({
                    by: 'vitest/prefer-called-once',
                    kind: 'exclusive',
                }),
                'vitest/prefer-describe-function-title': off({
                    by: 'vitest/valid-title — a describe of this estate names the behaviour it claims, not the function it calls',
                    kind: 'exclusive',
                }),
                'vitest/prefer-expect-assertions': off({
                    by: 'docs/reference/lint-presets.md — a spec states its assertions; counting them is bookkeeping the reader does not need',
                    kind: 'convention',
                }),
                'vitest/prefer-to-be-falsy': off({
                    by: 'vitest/prefer-strict-boolean-matchers — one asks for the strict matcher, the other for the falsy one',
                    kind: 'exclusive',
                }),
                'vitest/prefer-to-be-truthy': off({
                    by: 'vitest/prefer-strict-boolean-matchers — one asks for the strict matcher, the other for the truthy one',
                    kind: 'exclusive',
                }),
                'vitest/require-top-level-describe': off({
                    by: 'vitest/consistent-test-filename — the file name is the subject, and a describe that repeats it adds a level without adding meaning',
                    kind: 'covered',
                }),
                'vitest/require-hook': off({
                    by: 'docs/reference/lint-presets.md — the Given narration of a spec is the test body, not a hook',
                    kind: 'convention',
                }),
                'vitest/require-test-timeout': off({
                    by: 'docs/reference/lint-presets.md — the vitest config owns the timeout, once, for every suite',
                    kind: 'convention',
                }),

                'no-empty-function': off({
                    by: 'docs/reference/lint-presets.md — a test double with no behaviour is an empty function',
                    kind: 'convention',
                }),
            },
        }),
        // invariant: a no-op adapter is the test double a library ships for its consumers' tests, named `noop.adapter.ts`, or `noop-<port>.adapter.ts` when it ships one per port.
        scoped({
            files: ['**/noop.adapter.ts', '**/noop-*.adapter.ts'],
            rules: {
                'no-empty-function': off({
                    by: "docs/reference/lint-presets.md — a no-op adapter is the null object a consumer's tests are handed: it answers its port by doing nothing",
                    kind: 'convention',
                }),
            },
            since: '11.0.0',
        }),
    ],
    rules: {},
});
