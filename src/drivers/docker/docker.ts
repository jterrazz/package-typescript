import { handOver } from '../run.js';

/** Runs one container on the arguments given, its streams the terminal's, and answers its exit code. */
export const dockerRun = async (args: readonly string[]): Promise<number> =>
    await handOver('docker', ['run', ...args]);
