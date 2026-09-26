import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';

// Under `/tmp`, never the system's `TMPDIR`: a tool walking up for a config reads every parent, and a per-user
// temp folder can hold hundreds of thousands of entries. macOS `mktemp` ignores `TMPDIR`.
const BASE = '/tmp';

export default function setup(): () => void {
    const previous = process.env.TMPDIR;
    const root = mkdtempSync(join(BASE, 'typescript-specs-'));
    process.env.TMPDIR = root;

    return () => {
        if (previous === undefined) {
            delete process.env.TMPDIR;
        } else {
            process.env.TMPDIR = previous;
        }
        rmSync(root, { force: true, recursive: true });
    };
}
