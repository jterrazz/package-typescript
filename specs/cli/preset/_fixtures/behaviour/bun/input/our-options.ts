/*
 * outside: every line here breaks an OPTION this rulebook sets, where upstream's default
 * would have let it pass. `--fix` rewrites what it can; the rest reports.
 */

// outside: one-var: never — the fixer splits the chain, and no comment is swallowed.
export const alpha = 1,
    beta = 2;

// outside: max-params: 4 — upstream has no cap at all.
export function join(one: string, two: string, three: string, four: string, five: string): string {
    return one + two + three + four + five;
}

// outside: import/extensions: always — a relative import that Node ESM cannot resolve.
export { label } from './reasoned-offs';
