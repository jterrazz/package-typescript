import { projectBinary } from '../../../lint/kit/project/package-root.js';
import { run } from '../run.js';

/** Runs the unit's own `react-router typegen`, which writes the route types (`.react-router/types`) a fresh clone lacks, its report into `log`. */
export async function reactRouterTyped(unit: string, log: string): Promise<number> {
    return await run(projectBinary('react-router', unit), ['typegen'], {
        cwd: unit,
        stderr: 'stdout',
        stdout: { append: true, path: log },
    });
}
