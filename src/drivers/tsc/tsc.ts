import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import process from 'node:process';

import { binaryIn, HOISTED_BESIDE_PACKAGE } from '../../../lint/kit/project/package-root.js';
import { handOver, run } from '../run.js';

// outside: the binary is the platform package `@typescript/native` depends on, which npm hoists or nests beside it, so it resolves from that package's own folder, by the name its own `getExePath` builds.
function nativeCompiler(): string | undefined {
    try {
        const native = createRequire(import.meta.url).resolve('@typescript/native/package.json');
        const platform = `@typescript/typescript-${process.platform}-${process.arch}/package.json`;

        return join(dirname(createRequire(native).resolve(platform)), 'lib/tsc');
        // Stryker disable BlockStatement: a compiler left undefined is as absent as one refused
    } catch {
        return undefined;
    }
    // Stryker restore BlockStatement
}

const tscIn = (fallbackBin: string): string => nativeCompiler() ?? binaryIn('tsc', fallbackBin);

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
