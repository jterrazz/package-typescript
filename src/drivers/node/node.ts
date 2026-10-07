import process from 'node:process';

import { handOver } from '../run.js';

/** Runs the application the build wrote, handing it the terminal and the signals. */
export async function builtApplication(args: readonly string[], project: string): Promise<number> {
    return await handOver(
        process.execPath,
        ['--enable-source-maps', 'dist/index.js', ...args],
        project,
    );
}

/** Runs this toolchain's own command in another folder, as `cd <folder> && typescript <args>` runs it, handing it the terminal. */
export async function toolchainIn(folder: string, args: readonly string[]): Promise<number> {
    return await handOver(process.execPath, [String(process.argv[1]), ...args], folder);
}
