import { allOn, fragment, off } from '../../kit/compiler/decision.js';

export default fragment({
    id: 'node',
    audience: 'consumer',
    plugins: ['node'],
    rules: {
        ...allOn(
            [
                'callback-return',
                'exports-style',
                'global-require',
                'handle-callback-err',
                'no-exports-assign',
                'no-mixed-requires',
                'no-new-require',
                'no-path-concat',
            ].map((rule) => `node/${rule}`),
        ),

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
