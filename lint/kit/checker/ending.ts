import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';

const ENDING: readonly NodeJS.Signals[] = ['SIGHUP', 'SIGINT', 'SIGTERM'];

export async function cleanedUpOnEnding<T>(
    cleanUp: () => void,
    work: () => Promise<T>,
): Promise<T> {
    let cleaned = false;
    const once = (): void => {
        if (!cleaned) {
            cleaned = true;
            cleanUp();
        }
    };
    const ended = (signal: NodeJS.Signals): void => {
        for (const ending of ENDING) {
            process.off(ending, ended);
        }
        once();
        process.kill(process.pid, signal);
    };
    for (const signal of ENDING) {
        process.on(signal, ended);
    }
    try {
        return await work();
    } finally {
        for (const signal of ENDING) {
            process.off(signal, ended);
        }
        once();
    }
}

export async function inScratch<T>(work: (scratch: string) => Promise<T>): Promise<T> {
    const scratch = mkdtempSync(join(tmpdir(), 'typescript-'));

    return await cleanedUpOnEnding(
        () => {
            rmSync(scratch, { force: true, recursive: true });
        },
        async () => await work(scratch),
    );
}
