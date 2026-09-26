import { sep } from 'path';

let nested = sep;

export const nestedValue = nested;

export function take(value: string | undefined): string {
    return value ?? 'none';
}

export const taken = take(undefined);
