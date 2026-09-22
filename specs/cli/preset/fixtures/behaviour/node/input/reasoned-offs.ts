/*
 * Every line here breaks a rule the rulebook turns OFF with a recorded reason.
 * `--fix` must leave the file byte for byte as it is, and the report must stay
 * silent: an off nobody can see is an off nobody maintains.
 */

/** The type the options fixture imports, so the hoist has something to hoist. */
export type Options = { timeout: number };

// unicorn/no-nested-ternary — off (formatter): its fixer parenthesises, oxfmt strips.
export function label(count: number): string {
    return count === 0 ? 'none' : count === 1 ? 'one' : 'many';
}

// unicorn/number-literal-case — off (formatter): oxc#21949.
export const MASK = 0xff;

// no-magic-numbers — off (evidence): 125 reports on this package, none a defect.
export function timeout(): number {
    return 30_000;
}

// no-continue — off (exclusive with max-depth): continue is what keeps a body flat.
export function firstEven(values: number[]): number | undefined {
    for (const value of values) {
        if (value % 2 !== 0) {
            continue;
        }
        return value;
    }
    return undefined;
}

// id-length — off (evidence): a conventional short binding is not a defect.
export const pairs = [1, 2, 3].map((n) => n * 2);
