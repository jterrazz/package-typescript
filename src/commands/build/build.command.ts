import process from 'node:process';

import { readSettings } from '../../../lint/index.rules.js';
import { refusal } from '../../../lint/kit/catalogue/lesson.js';
import { planOf } from '../../../lint/kit/project/build-plan.js';
import { builtFrom, watched } from '../../drivers/tsdown/tsdown.js';
import { badge, GREEN, print, RED, RESET } from '../check/report/terminal.js';
import { refusedWhileGated } from '../gate-lock/lock.js';

export async function build(args: readonly string[] = []): Promise<number> {
    print(`${badge('TYPESCRIPT')} Building the entries the manifest publishes...\n\n`);
    const project = process.cwd();
    const gated = refusedWhileGated(project, 'a build');
    if (gated !== undefined) {
        print(`${RED}${gated}${RESET}\n`);

        return 1;
    }
    const steps = planOf(project, await readSettings(project));
    if (typeof steps === 'string') {
        print(`${RED}${steps}${RESET}\n`);

        return 1;
    }
    if (steps.length === 0) {
        print(
            `Nothing to build: a mobile app is bundled by its framework — \`npx expo export\` — and publishes nothing a package build compiles\n`,
        );

        return 0;
    }
    if (args.includes('--watch')) {
        // Stryker disable next-line ObjectLiteral,BooleanLiteral: a run that is not asked for, or asked for wrongly, starts the application after the first build, which prints after the marker a spec stops at, so no spec reads it; the arguments are proven in watchArguments
        return await watched(steps, project, { run: false });
    }
    const status = await builtFrom(steps, project);
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
