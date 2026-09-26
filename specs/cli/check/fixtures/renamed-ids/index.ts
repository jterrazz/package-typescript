// oxlint-disable-next-line jterrazz-typescript/comment-longer-than-function -- FIN-12, the finance team's policy, sets the ceiling
/**
 * Caps a value at the ceiling
 * the finance team fixed.
 */
function capped(value: number): number {
    return Math.min(value, 100);
}

export const CEILING = capped(250);
