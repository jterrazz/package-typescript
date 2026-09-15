import { allOn, fragment, off } from '../_contract.js';

/*
 * The `promise` plugin, all 15 non-nursery rules decided by name. The estate
 * writes `await`, so the two rules that describe a well-behaved `.then()`
 * chain are the ones that cannot hold beside `prefer-await-to-then`.
 */
export default fragment({
    id: 'core/promise',
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
