import { readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

/** The variable a stage hands its test runners, naming the folder where a process priced apart from them (a checker, a gate a spec starts) registers its pid while it runs, so its memory is no runner's. */
export const APART_VARIABLE = '__TYPESCRIPT_PRICED_APART__';

/** Registers process `pid` in the folder `APART_VARIABLE` names, when a stage names one that stands, and the gesture that takes it back. */
export function heldApart(
    pid: number = process.pid,
    environment: NodeJS.ProcessEnv = process.env,
): () => void {
    const folder = environment[APART_VARIABLE];
    if (folder === undefined) {
        return () => undefined;
    }
    const file = join(folder, String(pid));
    try {
        // Stryker disable next-line StringLiteral: a registration is the file's name; what it holds no one reads
        writeFileSync(file, '');

        return () => {
            rmSync(file, { force: true });
        };
    } catch {
        return () => undefined;
    }
}

/** The pids registered priced apart in `folder`; none where it does not stand. */
export function apartIn(folder: string): ReadonlySet<number> {
    try {
        return new Set(readdirSync(folder).map(Number).filter(Number.isInteger));
    } catch {
        return new Set();
    }
}
