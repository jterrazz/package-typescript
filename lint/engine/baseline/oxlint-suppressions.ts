import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { objectOf } from '../project/json.js';

export const OXLINT_SUPPRESSIONS = 'oxlint-suppressions.json';

export async function keptAcross<T>(root: string, run: () => Promise<T>): Promise<T> {
    const path = join(root, OXLINT_SUPPRESSIONS);
    let held: null | string = null;
    try {
        held = readFileSync(path, 'utf8');
    } catch {
        held = null;
    }
    try {
        return await run();
    } finally {
        if (held === null) {
            rmSync(path, { force: true });
        } else {
            writeFileSync(path, held);
        }
    }
}

export function removeWhenEmpty(root: string): void {
    if (suppressedCount(root) === 0) {
        rmSync(join(root, OXLINT_SUPPRESSIONS), { force: true });
    }
}

export function vanishedEntries(root: string): string[] {
    let parsed: unknown;
    try {
        parsed = JSON.parse(readFileSync(join(root, OXLINT_SUPPRESSIONS), 'utf8'));
    } catch {
        return [];
    }

    return Object.keys(objectOf(parsed)).filter((path) => !existsSync(join(root, path)));
}

export function suppressedCount(root: string): null | number {
    let parsed: unknown;
    try {
        parsed = JSON.parse(readFileSync(join(root, OXLINT_SUPPRESSIONS), 'utf8'));
    } catch {
        return null;
    }

    let total = 0;
    for (const rule of Object.values(objectOf(parsed)).flatMap((rules) =>
        Object.values(objectOf(rules)),
    )) {
        const { count } = objectOf(rule);
        total += typeof count === 'number' ? count : 0;
    }

    return total;
}
