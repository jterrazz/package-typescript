import { allOn, fragment, off } from '../_contract.js';

/*
 * The `node` plugin, all 11 rules decided by name.
 */
export default fragment({
    id: 'core/node',
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
            by: 'docs/07-lint-presets.md — the estate reads configuration from the environment at the edge and has no config-module to funnel it through',
            kind: 'convention',
        }),
        'node/no-sync': off({
            by: 'docs/07-lint-presets.md — a one-shot CLI script has no event loop to protect, and the toolchain gates are exactly that',
            kind: 'convention',
        }),
        'node/no-top-level-await': off({
            by: 'unicorn/prefer-top-level-await — one rule demands it, the other forbids it',
            kind: 'exclusive',
        }),
    },
});
