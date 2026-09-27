import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export async function inScratch<T>(work: (scratch: string) => Promise<T>): Promise<T> {
    const scratch = mkdtempSync(join(tmpdir(), 'typescript-'));
    try {
        return await work(scratch);
    } finally {
        rmSync(scratch, { force: true, recursive: true });
    }
}
