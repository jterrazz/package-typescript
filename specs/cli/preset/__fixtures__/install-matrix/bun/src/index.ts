export function greet(name: string): string {
    return `hello ${name}`;
}

export function runtime(): string {
    return Bun.version;
}
