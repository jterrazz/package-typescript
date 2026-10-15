import { LIMIT } from './limit.js';

export function discounted(price: number, rate: number): number {
    if (rate > LIMIT) {
        throw new Error('a discount above half the price');
    }

    return price - price * rate;
}
