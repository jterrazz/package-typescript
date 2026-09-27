// What test material IS belongs to `@jterrazz/test` alone: its reader is loaded from the install
// the package resolves, never copied here, and never from the toolchain's own install.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { resolveTestPackage } from './test-package.js';

export type TestMaterialReader = {
    materialAt: (path: string) => string | undefined;
    testPackageOf: (specifier: string) => string | undefined;
};

function importTarget(entry: unknown): null | string {
    if (typeof entry === 'string') {
        return entry;
    }
    if (entry === null || typeof entry !== 'object') {
        return null;
    }
    for (const condition of ['import', 'default']) {
        const target = importTarget((entry as Record<string, unknown>)[condition]);
        if (target !== null) {
            return target;
        }
    }

    return null;
}

function readerOf(loaded: Record<string, unknown>): null | TestMaterialReader {
    const { materialAt, testPackageOf } = loaded;
    return typeof materialAt === 'function' && typeof testPackageOf === 'function'
        ? ({ materialAt, testPackageOf } as TestMaterialReader)
        : null;
}

export async function testMaterialReader(
    root: string,
): Promise<
    { error: string; reason: 'unloadable' } | { reader: TestMaterialReader } | { reason: 'absent' }
> {
    const resolved = resolveTestPackage(root);
    if (resolved === null) {
        return { reason: 'absent' };
    }
    const { exports: exported } = resolved.manifest;
    const target = importTarget(
        typeof exported === 'object' && exported !== null
            ? (exported as Record<string, unknown>)['./oxlint']
            : undefined,
    );
    const entry = target === null ? null : join(resolved.dir, target);
    if (entry === null || !existsSync(entry)) {
        return { error: 'it has no `./oxlint` entry', reason: 'unloadable' };
    }
    let loaded: Record<string, unknown>;
    try {
        loaded = (await import(pathToFileURL(entry).href)) as Record<string, unknown>;
    } catch (error) {
        return {
            error: (error instanceof Error ? error.message : String(error)).split('\n')[0] ?? '',
            reason: 'unloadable',
        };
    }
    const reader = readerOf(loaded);

    return reader === null
        ? { error: 'its `./oxlint` entry exports no reader of test material', reason: 'unloadable' }
        : { reader };
}
