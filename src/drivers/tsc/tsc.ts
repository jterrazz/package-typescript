import { join } from 'node:path';
import process from 'node:process';

import {
    binaryIn,
    HOISTED_BESIDE_PACKAGE,
    isExecutable,
    PACKAGE_ROOT,
} from '../../../lint/kit/project/package-root.js';
import { handOver, run } from '../run.js';

const PLATFORMS: Readonly<Record<string, string>> = {
    darwin: 'darwin',
    linux: 'linux',
    win32: 'win32',
};

const ARCHITECTURES: Readonly<Record<string, string>> = { arm: 'arm', arm64: 'arm64', x64: 'x64' };

function tscIn(fallbackBin: string): string {
    const compiler = `@typescript/typescript-${PLATFORMS[process.platform] ?? 'linux'}-${ARCHITECTURES[process.arch] ?? 'x64'}/lib/tsc`;

    return (
        [join(PACKAGE_ROOT, 'node_modules', compiler), join(PACKAGE_ROOT, '../..', compiler)].find(
            (path) => isExecutable(path),
        ) ?? binaryIn('tsc', fallbackBin)
    );
}

export const tscBinary = (): string => tscIn(HOISTED_BESIDE_PACKAGE);

/** Type-checks one unit, the root's tsconfig or a member's, its report written to `log`. */
export async function typeChecked(tsc: string, unit: string, log: string): Promise<number> {
    return await run(tsc, unit === '.' ? ['--noEmit'] : ['--noEmit', '--project', unit], {
        stderr: 'stdout',
        stdout: { path: log },
    });
}

/** Hands the command line to the compiler this package ships, in the project. */
export async function tscHandedOver(args: readonly string[], project: string): Promise<number> {
    return await handOver(tscIn(join(project, 'node_modules/.bin')), args, project);
}
