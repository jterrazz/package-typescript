export type JsonObject = Readonly<Record<string, unknown>>;

export function isJsonObject(value: unknown): value is JsonObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function objectOf(value: unknown): JsonObject {
    return isJsonObject(value) ? value : {};
}

export function parsedObject(text: string): JsonObject {
    const parsed: unknown = JSON.parse(text);

    return objectOf(parsed);
}

export function stringsOf(value: unknown): string[] {
    return Array.isArray(value)
        ? value.filter((entry): entry is string => typeof entry === 'string')
        : [];
}
