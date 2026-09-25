/**
 * Doubles a value,
 * by adding it to itself.
 */
function doubled(value: number): number {
    return value + value;
}

// oxlint-disable-next-line jterrazz-typescript/comment-longer-than-function -- FIN-12, the finance team's policy, sets the ceiling
/**
 * Caps a value at the ceiling
 * the finance team fixed.
 */
function capped(value: number): number {
    return Math.min(value, 100);
}

// oxlint-disable-next-line jterrazz-typescript/comment-longer-than-function
/**
 * Halves a value,
 * by dividing it by two.
 */
function halved(value: number): number {
    return value / 2;
}

/**
 * Rounds half away from zero,
 * as the ledger requires.
 */
export function rounded(value: number): number {
    const bounded = halved(doubled(capped(value)));
    return Math.sign(bounded) * Math.round(Math.abs(bounded));
}
