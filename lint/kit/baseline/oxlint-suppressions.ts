import {
    copyFileSync,
    existsSync,
    mkdirSync,
    readdirSync,
    readFileSync,
    renameSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';

import { objectOf } from '../project/json.js';

export const OXLINT_SUPPRESSIONS = 'oxlint-suppressions.json';

export const SUPPRESSIONS_LEDGER = '.jterrazz/oxlint-suppressions.json';

// oxlint reads and writes its suppressions at the root of the run, under that one name, and offers no option to move them: the ledger is laid there for the run, and taken back after it.
export async function withStagedSuppressions<T>(root: string, run: () => Promise<T>): Promise<T> {
    const ledger = join(root, SUPPRESSIONS_LEDGER);
    const staged = join(root, OXLINT_SUPPRESSIONS);
    if (existsSync(ledger)) {
        copyFileSync(ledger, staged);
    }
    try {
        return await run();
    } finally {
        if (existsSync(staged)) {
            mkdirSync(dirname(ledger), { recursive: true });
            renameSync(staged, ledger);
        } else {
            rmSync(ledger, { force: true });
            if (existsSync(dirname(ledger)) && readdirSync(dirname(ledger)).length === 0) {
                rmSync(dirname(ledger), { recursive: true });
            }
        }
    }
}

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
