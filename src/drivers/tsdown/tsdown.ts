import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { readSettings } from '../../../lint/index.rules.js';
import { refusal } from '../../../lint/kit/catalogue/lesson.js';
import { inScratch } from '../../../lint/kit/checker/ending.js';
import { buildPlanOf, buildSettingsOf } from '../../../lint/kit/project/build-plan.js';
import type { BuildStep } from '../../../lint/kit/project/build-plan.js';
import { SETTINGS_FILE } from '../../../lint/kit/project/jterrazz-config.js';
import { binaryIn } from '../../../lint/kit/project/package-root.js';
import { presetLesson } from '../../../lint/kit/project/preset.js';
import { handOver, run } from '../run.js';

function tsdown(project: string): string {
    return binaryIn('tsdown', join(project, 'node_modules/.bin'));
}

/** The build the project's manifest and settings derive, or the refusal of a settings file that does not resolve. */
export async function planOf(project: string): Promise<BuildStep[] | string> {
    const { problem, resolved } = await readSettings(project);
    const declared = buildSettingsOf(resolved.sections.typescript);
    const refused = problem ?? declared.problem;

    return refused === null
        ? buildPlanOf(project, {
              declaration: resolved.declaration,
              settings: declared.settings,
          })
        : refusal({
              ...presetLesson(refused, SETTINGS_FILE),
              read: 'docs/reference/building.md#the-entries',
          });
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

/** Builds, runs the built application, and does both again on every change, until the process ends. */
export async function watched(steps: readonly BuildStep[], project: string): Promise<number> {
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
                    '--on-success',
                    'node --enable-source-maps dist/index.js',
                ],
                project,
            ),
    );
}
