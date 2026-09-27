import { accessSync, constants, existsSync, realpathSync } from 'node:fs';
import { delimiter, dirname, join } from 'node:path';
import process from 'node:process';

import { PACKAGE_ROOT } from '../../lint/engine/project/package-root.js';

export { PACKAGE_ROOT } from '../../lint/engine/project/package-root.js';

export const CHECKER = join(PACKAGE_ROOT, 'dist/checker.js');

export function presetAt(path: string): string {
    return join(PACKAGE_ROOT, path);
}

export function projectRoot(): string {
    const initial = process.env.INIT_CWD;

    return initial === undefined || initial === '' ? process.cwd() : initial;
}

export function isExecutable(path: string): boolean {
    try {
        accessSync(path, constants.X_OK);

        return true;
    } catch {
        return false;
    }
}

export function binaryIn(name: string, hoisted: string): string {
    return (
        [join(PACKAGE_ROOT, 'node_modules/.bin', name), join(hoisted, name)].find((path) =>
            isExecutable(path),
        ) ?? name
    );
}

export const HOISTED_BESIDE_PACKAGE = join(PACKAGE_ROOT, '../../.bin');

const PLATFORMS: Readonly<Record<string, string>> = {
    darwin: 'darwin',
    linux: 'linux',
    win32: 'win32',
};

const ARCHITECTURES: Readonly<Record<string, string>> = { arm: 'arm', arm64: 'arm64', x64: 'x64' };

// `tsc` on PATH is whatever the tree hoisted, under pnpm another package's TypeScript 5.
export function tscIn(hoisted: string): string {
    const compiler = `@typescript/typescript-${PLATFORMS[process.platform] ?? 'linux'}-${ARCHITECTURES[process.arch] ?? 'x64'}/lib/tsc`;

    return (
        [join(PACKAGE_ROOT, 'node_modules', compiler), join(PACKAGE_ROOT, '../..', compiler)].find(
            (path) => isExecutable(path),
        ) ?? binaryIn('tsc', hoisted)
    );
}

// oxlint looks `tsgolint` up on PATH, which a consumer's PATH has no reason to carry.
export function withTsgolintOnPath(hoisted: string): void {
    const tsgolint = binaryIn('tsgolint', hoisted);
    if (tsgolint.includes('/') && existsSync(tsgolint)) {
        process.env.PATH = `${realpathSync(dirname(tsgolint))}${delimiter}${process.env.PATH ?? ''}`;
    }
}
