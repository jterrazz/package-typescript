export const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

export function parsedJson<Shape>(text: string, holds: (value: unknown) => value is Shape): Shape {
    const value: unknown = JSON.parse(text);
    if (!holds(value)) {
        throw new Error(`the JSON is not the shape the spec reads: ${text.slice(0, 200)}`);
    }

    return value;
}
