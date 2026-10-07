import { mkdirSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';

// hazard: under `/tmp`, never the system's `TMPDIR`: a tool walking up for a config reads every parent, and a per-user
// temp folder can hold hundreds of thousands of entries. macOS `mktemp` ignores `TMPDIR`.
const BASE = '/tmp';

// invariant: a fixture resolves the toolchain the way an install does, from a `node_modules/` above it: its editor files and its settings import it, and the node preset reads `@types/node`.
const REPOSITORY = resolve(import.meta.dirname, '../../..');

// invariant: a spec's command measures what its own fixture changed; the commit CI names for this repository's run names none of a fixture's.
export default function setup(): () => void {
    const previous = process.env.TMPDIR;
    const since = process.env.TYPESCRIPT_MUTATION_SINCE;
    delete process.env.TYPESCRIPT_MUTATION_SINCE;
    const root = mkdtempSync(join(BASE, 'typescript-specs-'));
    process.env.TMPDIR = root;
    mkdirSync(join(root, 'node_modules/@jterrazz'), { recursive: true });
    symlinkSync(REPOSITORY, join(root, 'node_modules/@jterrazz/typescript'));
    symlinkSync(join(REPOSITORY, 'node_modules/@types'), join(root, 'node_modules/@types'));

    return () => {
        if (previous === undefined) {
            delete process.env.TMPDIR;
        } else {
            process.env.TMPDIR = previous;
        }
        if (since !== undefined) {
            process.env.TYPESCRIPT_MUTATION_SINCE = since;
        }
        rmSync(root, { force: true, recursive: true });
    };
}
