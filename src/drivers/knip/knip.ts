import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { readSettings } from '../../../lint/index.rules.js';
import { messageOf } from '../../../lint/kit/catalogue/lesson.js';
import { buildPlanOf, buildSettingsOf } from '../../../lint/kit/project/build-plan.js';
import {
    binaryIn,
    HOISTED_BESIDE_PACKAGE,
    PACKAGE_ROOT,
} from '../../../lint/kit/project/package-root.js';
import { run } from '../run.js';
import { mergedKnipConfig } from './config.js';
import { knipSettingsOf } from './settings.js';

export const knipBinary = (): string => binaryIn('knip', HOISTED_BESIDE_PACKAGE);

/** Runs knip over the project with the preset merged with what it declares, written to `merged`; a merge that fails is the run's report. */
export async function knip(
    binary: string,
    { log, merged }: { log: string; merged: string },
): Promise<number> {
    try {
        const { resolved } = await readSettings('.');
        const declared = resolved.declaration;
        const steps = buildPlanOf('.', {
            declaration: declared,
            settings: buildSettingsOf(resolved.sections.typescript).settings,
        });
        const config = mergedKnipConfig(join(PACKAGE_ROOT, 'src/presets/knip/config.json'), {
            entries: steps.flatMap(({ entry }) => Object.values(entry)),
            library: declared?.kind === 'library',
            settings: knipSettingsOf(resolved.sections.typescript),
        });
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
