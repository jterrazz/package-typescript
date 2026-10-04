import { existsSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

import { readSettings } from '../../lint/index.rules.js';
import { refusal } from '../../lint/kit/catalogue/lesson.js';
import { buildPlanOf, buildSettingsOf } from '../../lint/kit/project/build-plan.js';
import type { BuildStep } from '../../lint/kit/project/build-plan.js';
import { SETTINGS_FILE } from '../../lint/kit/project/jterrazz-config.js';
import { binaryIn } from '../../lint/kit/project/package-root.js';
import { presetLesson } from '../../lint/kit/project/preset.js';
import { handOver, run } from './processes.js';
import { inScratch } from './scratch.js';
import { badge, GREEN, print, RED, RESET } from './terminal.js';

function tsdown(project: string): string {
    return binaryIn('tsdown', join(project, 'node_modules/.bin'));
}

async function planOf(project: string): Promise<BuildStep[] | string> {
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

export async function builtFrom(
    steps: readonly BuildStep[],
    project: string,
    flags: readonly string[] = [],
): Promise<number> {
    return await inScratch(
        async (scratch) =>
            await run(tsdown(project), [
                '--config',
                written(scratch, steps),
                '--cwd',
                project,
                ...flags,
            ]),
    );
}

export async function build(): Promise<number> {
    print(`${badge('TYPESCRIPT')} Building the entries the manifest publishes...\n\n`);
    const project = process.cwd();
    const steps = await planOf(project);
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

export async function start(args: readonly string[]): Promise<number> {
    return await handOver(
        process.execPath,
        ['--enable-source-maps', 'dist/index.js', ...args],
        process.cwd(),
    );
}

export async function dev(): Promise<number> {
    print(`${badge('TYPESCRIPT')} Starting dev mode...\n\n`);
    const project = process.cwd();
    const steps = await planOf(project);
    if (typeof steps === 'string') {
        print(`${RED}${steps}${RESET}\n`);

        return 1;
    }

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

export function clean(): number {
    const artefacts = join(process.cwd(), '.artifacts');
    print(`${badge('TYPESCRIPT')} Removing artefacts...\n\n`);
    if (existsSync(artefacts)) {
        rmSync(artefacts, { force: true, recursive: true });
        print(`${GREEN}Removed .artifacts/${RESET}\n`);
    } else {
        print(`${GREEN}Nothing to remove — .artifacts/ is already absent${RESET}\n`);
    }

    return 0;
}
