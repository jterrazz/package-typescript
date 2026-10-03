import { existsSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { delimiter, dirname, join } from 'node:path';
import process from 'node:process';

import { binaryIn, isExecutable, PACKAGE_ROOT } from '../../lint/kit/project/package-root.js';

export const checkerProgram = (): string => createRequire(import.meta.url).resolve('#checker');

export function presetAt(path: string): string {
    return join(PACKAGE_ROOT, path);
}

export function projectRoot(): string {
    const initial = process.env.INIT_CWD;

    return initial === undefined || initial === '' ? process.cwd() : initial;
}

const PLATFORMS: Readonly<Record<string, string>> = {
    darwin: 'darwin',
    linux: 'linux',
    win32: 'win32',
};

const ARCHITECTURES: Readonly<Record<string, string>> = { arm: 'arm', arm64: 'arm64', x64: 'x64' };

export function tscIn(fallbackBin: string): string {
    const compiler = `@typescript/typescript-${PLATFORMS[process.platform] ?? 'linux'}-${ARCHITECTURES[process.arch] ?? 'x64'}/lib/tsc`;

    return (
        [join(PACKAGE_ROOT, 'node_modules', compiler), join(PACKAGE_ROOT, '../..', compiler)].find(
            (path) => isExecutable(path),
        ) ?? binaryIn('tsc', fallbackBin)
    );
}

export function withTsgolintOnPath(fallbackBin: string): void {
    const tsgolint = binaryIn('tsgolint', fallbackBin);
    if (tsgolint.includes('/') && existsSync(tsgolint)) {
        process.env.PATH = `${realpathSync(dirname(tsgolint))}${delimiter}${process.env.PATH ?? ''}`;
    }
}
