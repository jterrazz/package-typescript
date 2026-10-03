import { allOn, fragment, off } from '../../kit/compiler/decision.js';

// outside: the estate writes `await`: two rules describing a well-behaved `.then()` chain cannot hold beside `prefer-await-to-then`.
export default fragment({
    id: 'promise',
    audience: 'consumer',
    plugins: ['promise'],
    rules: {
        ...allOn(
            [
                'no-callback-in-promise',
                'no-multiple-resolved',
                'no-nesting',
                'no-new-statics',
                'no-promise-in-callback',
                'no-return-wrap',
                'param-names',
                'prefer-await-to-callbacks',
                'prefer-await-to-then',
                'prefer-catch',
                'spec-only',
                'valid-params',
            ].map((rule) => `promise/${rule}`),
        ),

        'promise/avoid-new': off(
            {
                by: 'rule review, 2026-09-27 — 17 reports on package-test and signews-api, every one wrapping a callback API, which only `new Promise` can do',
                kind: 'evidence',
            },
            '11.0.0',
        ),
        'promise/always-return': off({
            by: 'promise/prefer-await-to-then — it describes a .then() chain the estate does not write',
            kind: 'exclusive',
        }),
        'promise/catch-or-return': off({
            by: 'promise/prefer-await-to-then — it describes a .then() chain the estate does not write',
            kind: 'exclusive',
        }),
    },
});
