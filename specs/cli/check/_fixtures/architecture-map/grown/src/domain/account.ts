import { save } from '../infrastructure/store.js';

export function open(name: string): string {
    return save(name);
}
