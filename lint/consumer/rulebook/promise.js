import { allOn, fragment, off } from '../../engine/compiler/decision.js';

// The estate writes `await`: two rules describing a well-behaved `.then()` chain cannot hold beside `prefer-await-to-then`.
export default fragment({
    id: 'promise',
    audience: 'consumer',
    plugins: ['promise'],
    rules: {
        ...allOn(
            [
                'avoid-new',
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
