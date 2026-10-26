import {
    copyFileSync,
    existsSync,
    mkdirSync,
    readFileSync,
    renameSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';

import { cleanedUpOnEnding } from '../checker/ending.js';
import { objectOf } from '../project/json.js';
import { removeLedger } from './ledger-file.js';

export const OXLINT_SUPPRESSIONS = 'oxlint-suppressions.json';

export const SUPPRESSIONS_LEDGER = '.studio/oxlint-suppressions.json';

// outside: oxlint reads and writes its suppressions at the root of the run, under that one name, and offers no option to move them: the ledger is laid there for the run, and taken back after it.
export async function withStagedSuppressions<T>(root: string, run: () => Promise<T>): Promise<T> {
    const ledger = join(root, SUPPRESSIONS_LEDGER);
    const staged = join(root, OXLINT_SUPPRESSIONS);
    if (existsSync(ledger)) {
        copyFileSync(ledger, staged);
    }

    return await cleanedUpOnEnding(() => {
        if (existsSync(staged)) {
            mkdirSync(dirname(ledger), { recursive: true });
            renameSync(staged, ledger);
        } else {
            removeLedger(ledger);
        }
    }, run);
}

export async function keptAcross<T>(root: string, run: () => Promise<T>): Promise<T> {
    const path = join(root, OXLINT_SUPPRESSIONS);
    // Stryker disable next-line StringLiteral: the file is written back as read, and a buffer writes the same bytes as its text
    const held = existsSync(path) ? readFileSync(path, 'utf8') : null;
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
        // Stryker disable next-line ObjectLiteral,BooleanLiteral: a count of zero is read from a file that exists, which `force` is only there to forgive the absence of
        rmSync(join(root, OXLINT_SUPPRESSIONS), { force: true });
    }
}

export function vanishedEntries(root: string): string[] {
    let parsed: unknown;
    // Stryker disable StringLiteral,BlockStatement: JSON.parse reads a Buffer as its text, and an unreadable file leaves parsed undefined, which objectOf reads as no entries, the empty list either way
    try {
        parsed = JSON.parse(readFileSync(join(root, OXLINT_SUPPRESSIONS), 'utf8'));
    } catch {
        return [];
    }
    // Stryker restore StringLiteral,BlockStatement

    return Object.keys(objectOf(parsed)).filter((path) => !existsSync(join(root, path)));
}

export function suppressedCount(root: string): null | number {
    let parsed: unknown;
    try {
        // Stryker disable next-line StringLiteral: JSON.parse reads a Buffer as its text
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
