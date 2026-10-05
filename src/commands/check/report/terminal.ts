import { stdout } from 'node:process';

export const RED = '\u001B[0;31m';

export const GREEN = '\u001B[0;32m';

export const RESET = '\u001B[0m';

export function badge(label: string): string {
    return `\u001B[46m\u001B[1;30m ${label} ${RESET}`;
}

export function print(text: string | Uint8Array): void {
    stdout.write(text);
}
