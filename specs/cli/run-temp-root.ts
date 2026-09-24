import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';

/*
 * The run's own temp root: one directory holding every directory a spec
 * creates — the chains', the runner's working directories, and the install
 * scripts' sandboxes, which name `TMPDIR` in their template — because
 * `TMPDIR` points at it from before the first worker starts. Removed when the
 * run ends, with whatever a case left behind. The product's own `mktemp`
 * scratch directories are not in it: macOS `mktemp` ignores `TMPDIR`.
 *
 * It sits under `/tmp`, never under the system's `TMPDIR`: a tool that walks
 * up from its working directory for a config reads every parent directory,
 * and a per-user temp folder can hold hundreds of thousands of entries.
 */
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
