export function takes(value: string): string {
    return value;
}

declare const widened: any;

export const taken = takes(widened as unknown as string);
