// outside: found the way node resolves, from the package outward to the repository boundary: npm hoists a
// shared devDependency, and `@jterrazz/test`'s `exports` hides `./package.json` from `require.resolve`.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import { parsedObject } from './json.js';
import type { JsonObject } from './json.js';
import { isRepositoryRoot } from './repository-root.js';

const PACKAGE = '@jterrazz/test';

export type TestPackage = { dir: string; manifest: JsonObject };

export function resolveTestPackage(dir: string): null | TestPackage {
    let current = resolve(dir);

    while (true) {
        const installed = join(current, 'node_modules', PACKAGE);
        const manifest = join(installed, 'package.json');
        if (existsSync(manifest)) {
            try {
                return {
                    dir: installed,
                    manifest: parsedObject(readFileSync(manifest, 'utf8')),
                };
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

export function testPackageVersion(dir: string): null | string {
    const version = resolveTestPackage(dir)?.manifest.version;

    return typeof version === 'string' ? version : null;
}
