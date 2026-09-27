import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';

const ENDING: readonly NodeJS.Signals[] = ['SIGHUP', 'SIGINT', 'SIGTERM'];

export async function inScratch<T>(work: (scratch: string) => Promise<T>): Promise<T> {
    const scratch = mkdtempSync(join(tmpdir(), 'typescript-'));
    const removed = (): void => {
        rmSync(scratch, { force: true, recursive: true });
    };
    const ended = (signal: NodeJS.Signals): void => {
        removed();
        for (const ending of ENDING) {
            process.off(ending, ended);
        }
        process.kill(process.pid, signal);
    };
    for (const signal of ENDING) {
        process.on(signal, ended);
    }
    try {
        return await work(scratch);
    } finally {
        for (const signal of ENDING) {
            process.off(signal, ended);
        }
        removed();
    }
}
