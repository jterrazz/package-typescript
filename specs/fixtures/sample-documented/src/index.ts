/** Returns a friendly greeting for the given name. */
export function greet(name: string): string {
    return `Hello, ${name}!`;
}

/** Adds two numbers together. */
export function add(a: number, b: number): number {
    return a + b;
}

/** Severity levels emitted by the logger. */
export enum Level {
    Debug = 'debug',
    Error = 'error',
    Info = 'info',
    Warn = 'warn',
}

/** A registered user of the system. */
export type User = {
    id: number;
    name: string;
};

/** The current library version. */
export const VERSION = '1.0.0';
