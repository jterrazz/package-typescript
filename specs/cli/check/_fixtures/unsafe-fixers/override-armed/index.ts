export function take(value: string | undefined): string {
    return value ?? 'none';
}

export const taken = take(undefined);
