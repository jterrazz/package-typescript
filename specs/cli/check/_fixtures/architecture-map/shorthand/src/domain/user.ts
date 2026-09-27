import { save } from '../infrastructure/db.js';

export function remember(name: string): string {
    return save(name);
}
