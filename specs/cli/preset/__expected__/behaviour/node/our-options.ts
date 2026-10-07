/*
 * outside: every line here breaks an OPTION this rulebook sets, where upstream's default
 * would have let it pass. `--fix` rewrites what it can; the rest reports.
 */

/*
 * outside: import/consistent-type-specifier-style: prefer-top-level, and
 * typescript/consistent-type-imports at separate-type-imports. The fixer hoists
 * the inline `type` into an import of its own: under `verbatimModuleSyntax` an
 * all-inline type import is emitted as `import {}`, a runtime import of a
 * module that may only exist in a browser.
 */
import type { Options } from './reasoned-offs.js';

// outside: one-var: never — the fixer splits the chain, and no comment is swallowed.
export const alpha = 1;
    export const beta = 2;

// outside: max-params: 4 — upstream has no cap at all.
export function join(one: string, two: string, three: string, four: string, five: string): string {
    return one + two + three + four + five;
}

export function timeoutOf(options: Options): number {
    return options.timeout;
}

// outside: import/extensions: always — a relative import that Node ESM cannot resolve.
export { label } from './reasoned-offs';

// outside: typescript/prefer-optional-chain — nursery upstream, on here: the fixer writes the chain.
export function nameOf(user: undefined | { name: string }): string | undefined {
    return user?.name;
}
