import { user } from './domain/user.fixtures.js';

export function greet(): string {
    return `Hello, ${user.name}`;
}
