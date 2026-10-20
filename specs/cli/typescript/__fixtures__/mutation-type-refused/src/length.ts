export function lengthOf(value: string | undefined): number {
    if (value === undefined) {
        return 0;
    }

    return value.length;
}
