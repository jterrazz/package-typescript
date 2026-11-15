import type { Store } from '../ports/store.js';

export function greet(store: Store, name: string): string {
    return store.save(`hello ${name}`);
}
