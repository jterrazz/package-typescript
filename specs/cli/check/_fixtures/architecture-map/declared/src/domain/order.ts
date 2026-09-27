import { persisted } from '../infrastructure/outbound/orders.js';

export function placed(id: string): string {
    return persisted(id);
}
