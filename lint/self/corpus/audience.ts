import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

export const ROOT = resolve(import.meta.dirname, '../../..');

export const CHANNELS = ['checker', 'meta', 'runtime'];

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

export function fieldText(row: Record<string, unknown>, key: string): string {
    const value = row[key];
    return typeof value === 'string' ? value : '';
}

export const rows = [
    'lint/consumer/catalogue/manifest.json',
    'lint/self/catalogue/manifest.json',
].flatMap((path) => {
    const parsed: unknown = JSON.parse(readFileSync(join(ROOT, path), 'utf8'));
    return (Array.isArray(parsed) ? parsed : []).filter((row) => isRecord(row));
});

export function rowsOf(channel: string, audience: string): Record<string, unknown>[] {
    return rows.filter((row) => row.channel === channel && row.audience === audience);
}

export function shippedModules(directory: string): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) {
            return shippedModules(path);
        }
        return /\.(?:[cm]?js|sh)$/u.test(entry.name) ? [relative(ROOT, path)] : [];
    });
}

// An exit with anything but a literal 0 counts, a variable's value included.
export const REFUSALS: Record<string, { script: RegExp; module: RegExp }> = {
    exit: { module: /\bexit\((?!0\))/gu, script: /(?<![\w-])exit\s+(?:[1-9]|"?\$)/gu },
    reject: { module: /\breject\(/gu, script: /$^/gu },
    throw: { module: /\bthrow\s+(?:new\s+)?[\w$.]+\(/gu, script: /$^/gu },
};
