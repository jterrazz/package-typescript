import { off, on, scoped } from '../../kit/compiler/decision.js';
import type { Scoped } from '../../kit/compiler/decision.js';

export const SIZE_SINCE = '11.0.0';

// invariant: where a file's size has another judge, the caps of the eslint fragment stand aside.
export const ESLINT_SIZES_OVERRIDES: readonly Scoped[] = [
    // invariant: a spec file's size has one judge: `@jterrazz/test`'s `spec-file-within-line-limit`, at 400 lines.
    scoped({
        files: ['**/*.spec.ts'],
        rules: {
            'max-lines': off({
                by: '@jterrazz/test spec-file-within-line-limit: a spec file holds at most 400 lines, and one cap judges a file',
                kind: 'covered',
            }),
        },
        since: SIZE_SINCE,
    }),
    // invariant: a module test is held to the spec cap: its table tests list the cases of one module, and they ran 314 to 376 lines where the source's 300 gave them no seam.
    scoped({
        files: ['**/*.test.ts', '**/*.test.tsx'],
        rules: { 'max-lines': on([{ max: 400 }]) },
        since: SIZE_SINCE,
    }),
    // invariant: a test file's one `describe` (`one-describe-per-file`) is a function as long as the file; `test-body-within-line-limit` caps a test body instead.
    scoped({
        files: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts'],
        rules: {
            'max-lines-per-function': off({
                by: "@jterrazz/test test-body-within-line-limit: a test body holds at most 60 lines, and a test file's one describe is as long as the file",
                kind: 'covered',
            }),
            'max-statements': off({
                by: '@jterrazz/test test-body-within-line-limit: a test body holds at most 60 lines, and oxfmt puts one statement per line',
                kind: 'covered',
            }),
        },
        since: SIZE_SINCE,
    }),
    // invariant: a data module's length counts its rows, never its logic; `data-module-holds-data` keeps logic out of it.
    scoped({
        files: ['**/*.data.ts', '**/*.data.tsx'],
        rules: {
            'max-lines': off({
                by: 'jterrazz-typescript/data-module-holds-data: a `*.data.ts` module holds imports, types and the literals it exports, and no function, class or statement',
                kind: 'covered',
            }),
        },
        since: SIZE_SINCE,
    }),
    // invariant: an errors module is one vocabulary (a base and its subclasses) read together; `error-family-shares-its-base` keeps any other class out.
    scoped({
        files: ['**/errors.ts', '**/*.errors.ts'],
        rules: {
            'max-classes-per-file': off({
                by: 'jterrazz-typescript/error-family-shares-its-base: an errors module holds one class family, a base and what derives from it',
                kind: 'covered',
            }),
        },
        since: SIZE_SINCE,
    }),
    // invariant: a rule test is one table of the cases its rule decides; its length counts them, never two subjects in one file.
    scoped({
        files: ['lint/consumer/rules/**/*.test.ts'],
        rules: {
            'max-lines': off({
                by: 'docs/reference/rules-kit.md#testing-a-rule: a rule is proven by one RuleTester table of every case it decides',
                kind: 'convention',
            }),
        },
        since: SIZE_SINCE,
    }),
];
