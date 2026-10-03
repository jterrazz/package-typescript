import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { onTestFinished } from 'vitest';

export function newDirectory(prefix: string): string {
    return mkdtempSync(join(tmpdir(), prefix));
}

// invariant: removed when the current test finishes.
export function temporaryDirectory(prefix: string): string {
    const directory = newDirectory(prefix);
    onTestFinished(() => {
        rmSync(directory, { force: true, recursive: true });
    });

    return directory;
}
