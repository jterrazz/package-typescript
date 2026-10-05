import { isJsonObject } from './json.js';

const isReasoned = (record: Readonly<Record<string, unknown>>): boolean =>
    Object.values(record).every((value) => typeof value === 'string');

/** The settings a project writes with their reason — a `reason` beside one, or a name mapped to one — counted. */
export function exceptionsIn(written: unknown): number {
    if (Array.isArray(written)) {
        return written.reduce<number>((total, one) => total + exceptionsIn(one), 0);
    }
    if (!isJsonObject(written)) {
        return 0;
    }
    if (typeof written.reason === 'string') {
        return 1;
    }
    if (isReasoned(written)) {
        return Object.keys(written).length;
    }

    return Object.values(written).reduce<number>((total, one) => total + exceptionsIn(one), 0);
}
