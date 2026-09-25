/**
 * Three lines of comment
 * over a one-line body.
 */
export function restated(): number {
    return 1;
}

/** One line over one line. */
export function named(): number {
    return 2;
}

// oxlint-disable-next-line jterrazz-typescript/comment-longer-than-function -- ADR-7 of the payments team fixes this rounding
/**
 * Rounds half away from zero,
 * as the ledger requires.
 */
export function rounded(value: number): number {
    return Math.sign(value) * Math.round(Math.abs(value));
}

/**
 * As long as the body it sits on.
 */
export function balanced(left: number, right: number): number {
    const sum = left + right;
    const half = sum / 2;
    return half;
}

/**
 * Adds one,
 * to the count.
 */
const incremented = (count: number): number => count + 1;

export class Tally {
    private readonly start = 0;

    /**
     * Reads the total,
     * as it stands.
     */
    total(): number {
        return incremented(this.start);
    }
}
