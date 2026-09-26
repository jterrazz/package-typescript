// What test material IS belongs to `@jterrazz/test` alone: its reader is loaded from the install
// the package resolves, never copied here, and never from the toolchain's own install.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { resolveTestPackage } from './test-package.js';

function importTarget(entry) {
    if (typeof entry === 'string') {
        return entry;
    }
    if (entry === null || typeof entry !== 'object') {
        return null;
    }
    for (const condition of ['import', 'default']) {
        const target = importTarget(entry[condition]);
        if (target !== null) {
            return target;
        }
    }

    return null;
}

function readerOf({ materialAt, testPackageOf }) {
    return typeof materialAt === 'function' && typeof testPackageOf === 'function'
        ? { materialAt, testPackageOf }
        : null;
}

/**
 * @returns {Promise<
 *     | { reader: { materialAt: (path: string) => string | undefined, testPackageOf: (specifier: string) => string | undefined } }
 *     | { reason: 'absent' }
 *     | { error: string, reason: 'unloadable' }
 * >} the two readers, or why there are none
 */
export async function testMaterialReader(root) {
    const resolved = resolveTestPackage(root);
    if (resolved === null) {
        return { reason: 'absent' };
    }
    const target = importTarget(resolved.manifest.exports?.['./oxlint']);
    const entry = target === null ? null : join(resolved.dir, target);
    if (entry === null || !existsSync(entry)) {
        return { error: 'it has no `./oxlint` entry', reason: 'unloadable' };
    }
    let loaded;
    try {
        loaded = await import(pathToFileURL(entry).href);
    } catch (error) {
        return {
            error: (error instanceof Error ? error.message : String(error)).split('\n')[0],
            reason: 'unloadable',
        };
    }
    const reader = readerOf(loaded);

    return reader === null
        ? { error: 'its `./oxlint` entry exports no reader of test material', reason: 'unloadable' }
        : { reader };
}
