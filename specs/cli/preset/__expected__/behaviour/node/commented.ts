export function restated(): number {
    return 1;
}

/** One line over one line. */
export function named(): number {
    return 2;
}

export function rounded(value: number): number {
    return Math.sign(value) * Math.round(Math.abs(value));
}

export function balanced(left: number, right: number): number {
    const sum = left + right;
    const half = sum / 2;
    return half;
}

const incremented = (count: number): number => count + 1;

export class Tally {
    private readonly start = 0;

    total(): number {
        return incremented(this.start);
    }
}
