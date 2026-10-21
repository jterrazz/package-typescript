import { handOver } from '../run.js';

/** Runs the project's own `test` script, handing it the terminal and the signals, and the arguments given after `--`. */
export async function npmTest(project: string, args: readonly string[] = []): Promise<number> {
    return await handOver('npm', ['test', ...(args.length === 0 ? [] : ['--', ...args])], project);
}
