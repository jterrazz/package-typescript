export const CURRENCY = 'EUR';

export const SYMBOL = '€';

export function stored(cents: number): string {
    if (cents < 0) {
        throw new Error('a price below zero');
    }

    return `${cents} cents`;
}
