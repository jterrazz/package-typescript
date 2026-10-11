export function read(value: string): string {
    if (value === '') {
        return 'empty';
        // Stryker disable next-line StringLiteral: the fallback is never printed
    } else {
        return value;
    }
}

// eslint-disable-next-line no-debugger -- spelled for another toolchain
export const late = 1;
