import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { inScratch } from '../../../lint/kit/checker/ending.js';
import type { BuildStep } from '../../../lint/kit/project/build-plan.js';
import { binaryIn } from '../../../lint/kit/project/package-root.js';
import { handOver, run } from '../run.js';

function tsdown(project: string): string {
    return binaryIn('tsdown', join(project, 'node_modules/.bin'));
}

function written(scratch: string, steps: readonly BuildStep[]): string {
    const config = join(scratch, 'tsdown.config.mjs');
    writeFileSync(config, `export default ${JSON.stringify(steps, null, 4)};\n`);

    return config;
}

export async function builtFrom(steps: readonly BuildStep[], project: string): Promise<number> {
    return await inScratch(
        async (scratch) =>
            await run(tsdown(project), ['--config', written(scratch, steps), '--cwd', project]),
    );
}

/** Builds, and builds again on every change, until the process ends; the built application is run too when `run` is true. */
export async function watched(
    steps: readonly BuildStep[],
    project: string,
    { run: runs }: { run: boolean },
): Promise<number> {
    return await inScratch(
        async (scratch) =>
            await handOver(
                tsdown(project),
                [
                    '--config',
                    written(scratch, steps),
                    '--cwd',
                    project,
                    '--watch',
                    ...(runs ? ['--on-success', 'node --enable-source-maps dist/index.js'] : []),
                ],
                project,
            ),
    );
}
