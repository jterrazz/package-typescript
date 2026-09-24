import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/*
 * The run's own temp root: one directory under the system's, holding every
 * directory this run creates — the specs', the runner's working directories,
 * and whatever a spawned toolchain makes with `mktemp` — because `TMPDIR`
 * points at it from before the first worker starts. Removed when the run ends,
 * with whatever a case left behind.
 */
export default function setup(): () => void {
    const previous = process.env.TMPDIR;
    const root = mkdtempSync(join(tmpdir(), 'typescript-specs-'));
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
