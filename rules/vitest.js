import { allOn, fragment, off, on, scoped, unsafeFix } from './_contract.js';

/*
 * The `vitest` plugin, all 73 rules decided by name — inside an `overrides`
 * block, because every one of them reads a test file and says nothing about
 * anything else. The globs are the test shapes the estate writes:
 * `<name>.test.ts`, `<name>.spec.ts`, their type-test variants, and every file
 * under a `specs/` or `__tests__/` tree.
 *
 * Four of the offs are one half of an exclusive pair; the other half is on, and
 * `exclusive-pairs.test.ts` proves no profile ever arms both.
 */

/** Where a vitest rule applies. Nothing outside these globs is a test. */
export const TEST_FILES = Object.freeze([
    '**/*.{test,spec,test-d,spec-d}.{ts,tsx,js,jsx}',
    '**/specs/**/*.{ts,tsx}',
    '**/__tests__/**/*.{ts,tsx,js,jsx}',
]);

/** Every vitest rule that is on. The list is the roster minus the eight offs below. */
const ON_IN_TESTS = [
    'consistent-each-for',
    'consistent-test-filename',
    'consistent-vitest-vi',
    'expect-expect',
    'hoisted-apis-on-top',
    'max-expects',
    'max-nested-describe',
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
    'no-restricted-matchers',
    'no-restricted-vi-methods',
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
    'prefer-import-in-mock',
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

/*
 * The three vitest fixers that change meaning, so `fix` never applies them and
 * `check` still reports them. They are named here rather than inline because a
 * decision three calls deep inside an override reads as nesting, not as a
 * decision.
 *
 * `prefer-lowercase-title` carries no `allowedPrefixes`: the rule is stricter
 * than the `j5` rule @jterrazz/test retires for it — it also refuses a title
 * opening on an all-caps identifier (`HTTP 404 …`, `DI …`) — and an existing
 * title is a rename, not a case for an estate-specific escape hatch.
 */
const CONSISTENT_TEST_IT = unsafeFix(
    on([{ fn: 'test' }]),
    'rewrites `it(` into `test(` and leaves `import { it }` behind',
);
const PREFER_LOWERCASE_TITLE = unsafeFix(
    on(),
    'lower-cases the first character blindly: `CLI …` becomes `cLI …`',
);
const REQUIRE_MOCK_TYPE_PARAMETERS = unsafeFix(
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

export default fragment({
    id: 'vitest',
    plugins: ['vitest'],
    overrides: [
        scoped({
            files: [...TEST_FILES],
            rules: {
                ...allOn(ON_IN_TESTS),

                'vitest/consistent-test-it': CONSISTENT_TEST_IT,
                'vitest/prefer-lowercase-title': PREFER_LOWERCASE_TITLE,
                'vitest/require-mock-type-parameters': REQUIRE_MOCK_TYPE_PARAMETERS,
                'vitest/prefer-strict-boolean-matchers': PREFER_STRICT_BOOLEAN_MATCHERS,
                'vitest/prefer-called-with': PREFER_CALLED_WITH,

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
                    by: 'docs/07-lint-presets.md — a spec states its assertions; counting them is bookkeeping the reader does not need',
                    kind: 'convention',
                }),
                /* The pair the other way round. `toBe(true)` is a strict
                 * boolean assertion and `toBeTruthy()` is not — the fixer that
                 * rewrote one into the other WEAKENED every spec it touched. */
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
                    by: 'docs/07-lint-presets.md — the Given narration of a spec is the test body, not a hook',
                    kind: 'convention',
                }),
                'vitest/require-test-timeout': off({
                    by: 'docs/07-lint-presets.md — vitest.config.ts owns the timeout, once, for every suite',
                    kind: 'convention',
                }),

                // A test double is an empty function by definition.
                'no-empty-function': off({
                    by: 'docs/07-lint-presets.md — a test double with no behaviour is an empty function',
                    kind: 'convention',
                }),
            },
        }),
    ],
    rules: {},
});
