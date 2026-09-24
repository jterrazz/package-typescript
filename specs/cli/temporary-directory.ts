import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { onTestFinished } from 'vitest';

/** A new directory under the run's temp root (`run-temp-root.ts`), named after `prefix`. */
export function newDirectory(prefix: string): string {
    return mkdtempSync(join(tmpdir(), prefix));
}

/** A new directory under the run's temp root, removed when the current test finishes. */
export function temporaryDirectory(prefix: string): string {
    const directory = newDirectory(prefix);
    onTestFinished(() => {
        rmSync(directory, { force: true, recursive: true });
    });

    return directory;
}
