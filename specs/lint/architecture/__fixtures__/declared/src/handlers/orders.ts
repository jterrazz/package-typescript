import { placed } from '../domain/order.js';
import { stored } from '../store/orders.js';

export function handle(id: string): string {
    return `${placed(id)}${stored(id)}`;
}
