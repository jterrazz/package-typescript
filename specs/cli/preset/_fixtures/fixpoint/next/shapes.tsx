/*
 * The shapes that ping-pong. Each one is a place where a lint fixer and the
 * formatter have historically rewritten each other, so a round of
 * `oxlint --fix` then `oxfmt` must land here and stay.
 */

// A hex literal: unicorn/number-literal-case and oxfmt disagree on its case.
export const MASK = 0xff_00_ff;

// A nested ternary: unicorn/no-nested-ternary parenthesises, oxfmt strips.
export function label(count: number): string {
    return count === 0 ? 'none' : count === 1 ? 'one' : 'many';
}

// JSX attribute order is perfectionist's; the formatter never reorders one.
export function Badge({ tone, label: text }: { label: string; tone: string }): React.JSX.Element {
    return <output className={tone}>{text}</output>;
}
