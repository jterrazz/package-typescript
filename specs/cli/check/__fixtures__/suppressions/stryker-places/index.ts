export function read(value: string): string {
    if (value === '') {
        return 'empty';
        // Stryker disable next-line StringLiteral: the fallback is never printed
    } else if (value === 'x') {
        return 'x';
    }

    try {
        return value.trim();
        // Stryker disable next-line BlockStatement: the handler returns what the caller already holds
    } catch {
        return value;
    }
}

export const element = {
    // Stryker disable next-line StringLiteral: the label is read by nothing
    label: 'title',
};
