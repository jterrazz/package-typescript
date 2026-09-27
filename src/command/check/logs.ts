import { appendFileSync, existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export type Logs = {
    at: (name: string) => string;
    holds: (path: string) => boolean;
    read: (path: string) => string;
};

export function logsIn(directory: string): Logs {
    return {
        at: (name) => join(directory, name),
        holds: (path) => (statSync(path, { throwIfNoEntry: false })?.size ?? 0) > 0,
        read: (path) => (existsSync(path) ? readFileSync(path, 'utf8') : ''),
    };
}

export function joined(logs: Logs, into: string, parts: readonly string[]): void {
    writeFileSync(into, '');
    for (const part of parts) {
        if (logs.holds(part)) {
            appendFileSync(into, readFileSync(part));
        }
    }
}
