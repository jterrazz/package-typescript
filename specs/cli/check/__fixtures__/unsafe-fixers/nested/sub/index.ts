import { sep } from 'path';

let nested = sep;

export const nestedValue = nested;

export const taken = (): Promise<number> => Promise.resolve(1);
