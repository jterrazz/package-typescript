import { handOver } from '../run.js';

/** Runs the project's own `test` script, handing it the terminal and the signals. */
export async function npmTest(project: string): Promise<number> {
    return await handOver('npm', ['test'], project);
}
