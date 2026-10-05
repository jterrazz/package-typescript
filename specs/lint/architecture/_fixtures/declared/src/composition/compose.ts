import { nameOf } from '../application/services/naming.js';
import { persisted } from '../infrastructure/outbound/orders.js';

export function compose(): { name: string; order: string } {
    return { name: nameOf({ name: 'ada' }), order: persisted('1') };
}
