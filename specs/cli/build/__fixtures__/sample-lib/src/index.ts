export function greet(name: string): string {
    return `Hello, ${name}!`;
}

export function add(a: number, b: number): number {
    return a + b;
}

export type User = {
    id: number;
    name: string;
};

export const VERSION = '1.0.0';
