import { allOn, fragment, off } from '../../kit/compiler/decision.js';

// outside: the estate writes `await`: two rules describing a well-behaved `.then()` chain cannot hold beside `jterrazz-typescript/promise-is-awaited`.
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
                'prefer-catch',
                'spec-only',
                'valid-params',
            ].map((rule) => `promise/${rule}`),
        ),

        'promise/avoid-new': off(
            {
                by: 'rule review, 2026-09-27: 17 reports on package-test and signews-api, every one wrapping a callback API, which only `new Promise` can do',
                kind: 'evidence',
            },
            '11.0.0',
        ),
        'promise/prefer-await-to-callbacks': off(
            {
                by: "the vision-17 pilots, 2026-10-06: every report a callback a framework's signature dictates, not one an API the estate wrote: Hono's `onError` (studio-os console), commander's exit hook (studio-os cli), OpenTelemetry's observable callback (package-telemetry, renamed to dodge the rule); it reads a first parameter named `error` and a parameter named `callback`, never whether an awaitable form exists",
                kind: 'evidence',
            },
            '11.0.0',
        ),
        'promise/prefer-await-to-then': off(
            {
                by: "jterrazz-typescript/promise-is-awaited: it reads the name `.catch`, never the type, so a zod schema's `.catch(fallback)` failed it (the signews-mobile pilot, 2026-10-07, rewrote its schemas into `safeParse` to pass; signews-web's response schemas hold the same shape); the plugin's rule awaits every chain the same way and reads a value given to `.catch()` as no promise",
                kind: 'covered',
            },
            '11.0.0',
        ),
        'promise/always-return': off({
            by: 'jterrazz-typescript/promise-is-awaited: it describes a .then() chain the estate does not write',
            kind: 'exclusive',
        }),
        'promise/catch-or-return': off({
            by: 'jterrazz-typescript/promise-is-awaited: it describes a .then() chain the estate does not write',
            kind: 'exclusive',
        }),
    },
});
