import { writeFileSync } from 'node:fs';

import { messageOf } from '../../../lint/kit/catalogue/lesson.js';
import { binaryIn, HOISTED_BESIDE_PACKAGE } from '../../../lint/kit/project/package-root.js';
import { run } from '../run.js';
import type { KnipProject } from './settings.js';
import { knipConfigOf } from './workspaces.js';

export const knipBinary = (): string => binaryIn('knip', HOISTED_BESIDE_PACKAGE);

export type { KnipProject, KnipUnit } from './settings.js';

/** Runs knip over the project with the preset merged with what it declares, written to `merged`; a merge that fails is the run's report. */
export async function knip(
    binary: string,
    project: KnipProject,
    { log, merged }: { log: string; merged: string },
): Promise<number> {
    try {
        const config = knipConfigOf(project);
        writeFileSync(merged, JSON.stringify(config));
    } catch (error) {
        writeFileSync(log, `${messageOf(error)}\n`);

        return 1;
    }

    return await run(binary, ['--no-progress', '--no-config-hints', '--config', merged], {
        stderr: 'stdout',
        stdout: { path: log },
    });
}
