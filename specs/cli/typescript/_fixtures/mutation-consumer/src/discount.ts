export function discounted(price: number, rate: number): number {
    if (rate > 0.5) {
        throw new Error('a discount above half the price');
    }

    return price - price * rate;
}
