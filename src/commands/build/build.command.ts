import process from 'node:process';

import { readSettings } from '../../../lint/index.rules.js';
import { refusal } from '../../../lint/kit/catalogue/lesson.js';
import { planOf } from '../../../lint/kit/project/build-plan.js';
import { builtFrom } from '../../drivers/tsdown/tsdown.js';
import { badge, GREEN, print, RED, RESET } from '../check/report/terminal.js';

export async function build(): Promise<number> {
    print(`${badge('TYPESCRIPT')} Building the entries the manifest publishes...\n\n`);
    const project = process.cwd();
    const steps = planOf(project, await readSettings(project));
    const status =
        typeof steps === 'string'
            ? (print(`${RED}${steps}${RESET}\n`), 1)
            : await builtFrom(steps, project);
    if (status !== 0) {
        print(
            `${RED}${refusal({
                fix: 'repair what tsdown names above, then run the build again',
                found: 'tsdown could not build the project — its own report is above',
                read: 'docs/reference/building.md#a-build-that-fails',
                why: 'dist/ is what `start` runs and what the package publishes, and a build that stopped part-way leaves it stale',
            })}${RESET}\n`,
        );

        return 1;
    }
    print(`\n${GREEN}Build completed${RESET}\n`);

    return 0;
}
