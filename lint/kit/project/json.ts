export type JsonObject = Readonly<Record<string, unknown>>;

export function isJsonObject(value: unknown): value is JsonObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isList(value: unknown): value is readonly unknown[] {
    return Array.isArray(value);
}

export function listOf(value: unknown): readonly unknown[] {
    return Array.isArray(value) ? value : [];
}

export function objectOf(value: unknown): JsonObject {
    return isJsonObject(value) ? value : {};
}

export function parsedObject(text: string): JsonObject {
    const parsed: unknown = JSON.parse(text);

    return objectOf(parsed);
}

export function stringRecordOf(value: unknown): Record<string, string> {
    return Object.fromEntries(
        Object.entries(objectOf(value)).filter(
            (entry): entry is [string, string] => typeof entry[1] === 'string',
        ),
    );
}

export function textOf(value: unknown): string {
    return typeof value === 'string' ? value : '';
}

export function stringOf(value: unknown): null | string {
    return typeof value === 'string' ? value : null;
}

export function stringsOf(value: unknown): string[] {
    return Array.isArray(value)
        ? value.filter((entry): entry is string => typeof entry === 'string')
        : [];
}
