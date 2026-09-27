import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

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

// An exit with anything but a literal 0 counts, a variable's value included.
export const REFUSALS: Record<string, RegExp> = {
    exit: /\bexit\((?!0\))/gu,
    reject: /\breject\(/gu,
    throw: /\bthrow\s+(?:new\s+)?[\w$.]+\(/gu,
};
