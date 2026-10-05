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
