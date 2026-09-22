import { type User } from '../../domain/user.entity.js';

export function getUser(id: string): User {
    return { id };
}
