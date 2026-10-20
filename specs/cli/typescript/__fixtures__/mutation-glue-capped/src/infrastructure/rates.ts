export function rated(cents: number): boolean[] {
    return [
        cents > 1,
        cents > 2,
        cents > 3,
        cents > 4,
        cents > 5,
        cents > 6,
        cents > 7,
        cents > 8,
        cents > 9,
        cents > 10,
        cents > 11,
        cents > 12,
        cents > 13,
        cents > 14,
        cents > 15,
        cents > 16,
    ];
}
