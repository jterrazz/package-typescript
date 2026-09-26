// Found the way node resolves, from the package outward to the repository boundary: npm hoists a
// shared devDependency, and `@jterrazz/test`'s `exports` hides `./package.json` from `require.resolve`.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import { isRepositoryRoot } from './repository-root.js';

const PACKAGE = '@jterrazz/test';

const CHECKER_BIN = 'jterrazz-test-check';

export function resolveTestPackage(dir) {
    let current = resolve(dir);

    while (true) {
        const installed = join(current, 'node_modules', PACKAGE);
        const manifest = join(installed, 'package.json');
        if (existsSync(manifest)) {
            try {
                return { dir: installed, manifest: JSON.parse(readFileSync(manifest, 'utf8')) };
            } catch {
                return null;
            }
        }

        const parent = dirname(current);
        if (isRepositoryRoot(current) || parent === current) {
            return null;
        }
        current = parent;
    }
}

export function testPackageVersion(dir) {
    const { manifest } = resolveTestPackage(dir) ?? {};

    return typeof manifest?.version === 'string' ? manifest.version : null;
}

// The entry the same install declares: a `.bin` shim answers for whichever member npm hoisted to.
export function testPackageBin(dir) {
    const resolved = resolveTestPackage(dir);
    if (resolved === null) {
        return null;
    }

    const { bin } = resolved.manifest;
    const entry = typeof bin === 'string' ? bin : bin?.[CHECKER_BIN];
    if (typeof entry !== 'string') {
        return null;
    }

    const path = join(resolved.dir, entry);

    return existsSync(path) ? path : null;
}
