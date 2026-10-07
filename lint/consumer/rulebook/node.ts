import { allOn, fragment, off, on } from '../../kit/compiler/decision.js';

export default fragment({
    id: 'node',
    audience: 'consumer',
    plugins: ['node'],
    rules: {
        ...allOn(
            [
                'exports-style',
                'global-require',
                'handle-callback-err',
                'no-exports-assign',
                'no-mixed-requires',
                'no-new-require',
                'no-path-concat',
            ].map((rule) => `node/${rule}`),
        ),

        // invariant: `next` is left out: in Hono's middleware it is a continuation the handler awaits and then runs on after,
        // which the rule refuses for want of a `return`.
        'node/callback-return': { ...on([['callback', 'cb']]), since: '11.0.0' },

        'node/no-process-env': off({
            by: 'docs/reference/lint-presets.md — the estate reads configuration from the environment at the edge and has no config-module to funnel it through',
            kind: 'convention',
        }),
        'node/no-sync': off({
            by: 'docs/reference/lint-presets.md — a one-shot CLI script has no event loop to protect, and the toolchain gates are exactly that',
            kind: 'convention',
        }),
        'node/no-top-level-await': off({
            by: 'unicorn/prefer-top-level-await — one rule demands it, the other forbids it',
            kind: 'exclusive',
        }),
    },
});
