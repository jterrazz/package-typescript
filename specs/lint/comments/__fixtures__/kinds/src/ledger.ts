// value: the ceiling FIN-12 sets
const CEILING = 100;

// rounds half away from zero
function capped(value: number): number {
    return Math.min(value, CEILING);
}

/** Rounds half away from zero, as the ledger requires. */
export function rounded(value: number): number {
    const bounded = capped(value); // the bounded value
    return Math.sign(bounded) * Math.round(Math.abs(bounded));
}

// oxlint-disable-next-line no-console -- hazard: the ledger prints its total
export const total = (value: number): number => value;
