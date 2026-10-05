import { projectBinary } from '../../../lint/kit/project/package-root.js';
import { run } from '../run.js';

/** Runs the unit's own `astro check`, its report appended to `log`. */
export async function astroChecked(unit: string, log: string): Promise<number> {
    return await run(projectBinary('astro', unit), ['check'], {
        cwd: unit,
        stderr: 'stdout',
        stdout: { append: true, path: log },
    });
}
