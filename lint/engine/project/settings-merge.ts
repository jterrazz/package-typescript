import { isJsonObject } from './json.js';

export type Merged = { problem: null | string; value: unknown };

const shapeOf = (value: unknown): string =>
    Array.isArray(value) ? 'a list' : isJsonObject(value) ? 'an object' : 'a single value';

// Lists concatenate with duplicates dropped, records merge key by key, and a single value written wins over a default; a list or a record is never replaced by another shape, so no default law is written away.
export function mergeSettings(base: unknown, own: unknown, at = 'the section'): Merged {
    if (own === undefined) {
        return { problem: null, value: base };
    }
    if (
        base !== undefined &&
        shapeOf(base) !== shapeOf(own) &&
        shapeOf(base) !== 'a single value'
    ) {
        return {
            problem: `writes ${shapeOf(own)} at \`${at}\`, where its presets set ${shapeOf(base)} — a setting adds to a default, never replaces its shape`,
            value: base,
        };
    }
    if (Array.isArray(base) && Array.isArray(own)) {
        return { problem: null, value: mergedList(base, own) };
    }

    return isJsonObject(base) && isJsonObject(own)
        ? mergedRecord(base, own, at)
        : { problem: null, value: own };
}

function mergedList(base: readonly unknown[], own: readonly unknown[]): unknown[] {
    const merged = new Set<unknown>(base);
    for (const value of own) {
        merged.add(value);
    }

    return [...merged];
}

function mergedRecord(
    base: Readonly<Record<string, unknown>>,
    own: Readonly<Record<string, unknown>>,
    at: string,
): Merged {
    const merged: Record<string, unknown> = { ...base };
    for (const [key, value] of Object.entries(own)) {
        const one = mergeSettings(base[key], value, `${at}.${key}`);
        if (one.problem !== null) {
            return one;
        }
        merged[key] = one.value;
    }

    return { problem: null, value: merged };
}
