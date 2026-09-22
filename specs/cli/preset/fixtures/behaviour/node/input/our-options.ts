/*
 * Every line here breaks an OPTION this rulebook sets, where upstream's default
 * would have let it pass. `--fix` rewrites what it can; the rest reports.
 */

/*
 * import/consistent-type-specifier-style: prefer-top-level, and
 * typescript/consistent-type-imports at separate-type-imports. The fixer hoists
 * the inline `type` into an import of its own: under `verbatimModuleSyntax` an
 * all-inline type import is emitted as `import {}`, a runtime import of a
 * module that may only exist in a browser.
 */
import { type Options } from './reasoned-offs.js';

// one-var: never — the fixer splits the chain, and no comment is swallowed.
export const alpha = 1,
    beta = 2;

// max-params: 4 — upstream has no cap at all.
export function join(one: string, two: string, three: string, four: string, five: string): string {
    return one + two + three + four + five;
}

// typescript/consistent-type-definitions: 'type' — upstream defaults to interface.
export interface Point {
    x: number;
}

export function timeoutOf(options: Options): number {
    return options.timeout;
}

// import/extensions: always — a relative import that Node ESM cannot resolve.
export { label } from './reasoned-offs';
