import { user } from './domain/user.fixtures.js';

export function greetUser(): string {
    return `Hello, ${user.name}`;
}
