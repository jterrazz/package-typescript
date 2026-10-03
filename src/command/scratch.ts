import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { cleanedUpOnEnding } from '../../lint/kit/checker/ending.js';

export async function inScratch<T>(work: (scratch: string) => Promise<T>): Promise<T> {
    const scratch = mkdtempSync(join(tmpdir(), 'typescript-'));

    return await cleanedUpOnEnding(
        () => {
            rmSync(scratch, { force: true, recursive: true });
        },
        async () => await work(scratch),
    );
}
