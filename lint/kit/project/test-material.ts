// invariant: what test material IS belongs to `@jterrazz/test` alone: its reader is loaded from the install
// the package resolves, never copied here, and never from the toolchain's own install.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { isJsonObject, objectOf } from './json.js';
import { resolveTestPackage } from './test-package.js';

export type TestMaterialReader = {
    materialAt: (path: string) => string | undefined;
    testPackageOf: (specifier: string) => string | undefined;
};

function importTarget(entry: unknown): null | string {
    if (typeof entry === 'string') {
        return entry;
    }
    if (!isJsonObject(entry)) {
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

function answered(read: unknown, argument: string): string | undefined {
    const answer: unknown =
        typeof read === 'function' ? Reflect.apply(read, undefined, [argument]) : undefined;

    return typeof answer === 'string' ? answer : undefined;
}

function readerOf(loaded: unknown): null | TestMaterialReader {
    const { materialAt, testPackageOf } = objectOf(loaded);
    return typeof materialAt === 'function' && typeof testPackageOf === 'function'
        ? {
              materialAt: (path) => answered(materialAt, path),
              testPackageOf: (specifier) => answered(testPackageOf, specifier),
          }
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
    const target = importTarget(objectOf(exported)['./oxlint']);
    const entry = target === null ? null : join(resolved.dir, target);
    if (entry === null || !existsSync(entry)) {
        return { error: 'it has no `./oxlint` entry', reason: 'unloadable' };
    }
    let loaded: unknown;
    try {
        loaded = await import(pathToFileURL(entry).href);
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
