import { allOn, fragment, off } from './decision.js';

// The three offs restrict syntax for a target older than the one the estate compiles to.
export default fragment({
    id: 'oxc',
    audience: 'consumer',
    plugins: ['oxc'],
    rules: {
        ...allOn(
            [
                'approx-constant',
                'bad-array-method-on-arguments',
                'bad-bitwise-operator',
                'bad-char-at-comparison',
                'bad-comparison-sequence',
                'bad-match-all-arg',
                'bad-min-max-func',
                'bad-object-literal-comparison',
                'bad-replace-all-arg',
                'branches-sharing-code',
                'const-comparisons',
                'double-comparisons',
                'erasing-op',
                'misrefactored-assign-op',
                'missing-throw',
                'no-accumulating-spread',
                'no-async-endpoint-handlers',
                'no-barrel-file',
                'no-const-enum',
                'no-map-spread',
                'no-this-in-exported-function',
                'number-arg-out-of-range',
                'only-used-in-recursion',
                'uninvoked-array-callback',
            ].map((rule) => `oxc/${rule}`),
        ),

        'oxc/no-async-await': off({
            by: 'promise/prefer-await-to-then — one rule demands await, the other forbids it',
            kind: 'exclusive',
        }),
        'oxc/no-optional-chaining': off({
            by: 'docs/07-lint-presets.md — the estate compiles to ESNext on Node 24, where optional chaining is native syntax',
            kind: 'convention',
        }),
        'oxc/no-rest-spread-properties': off({
            by: 'docs/07-lint-presets.md — the estate compiles to ESNext on Node 24, where object rest and spread are native syntax',
            kind: 'convention',
        }),
    },
});
