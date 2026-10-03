import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

import { refusal } from '../../lint/kit/catalogue/lesson.js';
import { binaryIn } from '../../lint/kit/project/package-root.js';
import { handOver, run } from './processes.js';
import { badge, GREEN, print, RED, RESET } from './terminal.js';
import { presetAt, projectRoot } from './toolchain.js';

const BUILD_PRESET = presetAt('dist/presets/tsdown/build.js');

const BUNDLE_PRESET = presetAt('dist/presets/tsdown/bundle.js');

function tsdown(project: string): string {
    return binaryIn('tsdown', join(project, 'node_modules/.bin'));
}

async function built(config: string, label: string): Promise<number> {
    print(`${badge('TYPESCRIPT')} ${label}...\n\n`);
    const project = projectRoot();
    process.chdir(project);
    const status = await run(tsdown(project), ['--config', config, '--cwd', project]);
    if (status !== 0) {
        print(
            `${RED}${refusal({
                fix: 'repair what tsdown names above, then run the build again',
                found: 'tsdown could not build the project — its own report is above',
                read: 'docs/09-building.md#a-build-that-fails',
                why: 'dist/ is what `start` runs and what the package publishes, and a build that stopped part-way leaves it stale',
            })}${RESET}\n`,
        );

        return 1;
    }
    print(`\n${GREEN}Build completed${RESET}\n`);

    return 0;
}

export async function build(): Promise<number> {
    return await built(BUILD_PRESET, 'Building application (ESM + types)');
}

export async function bundle(): Promise<number> {
    return await built(BUNDLE_PRESET, 'Bundling library (ESM + CJS + types)');
}

export async function start(args: readonly string[]): Promise<number> {
    return await handOver(
        process.execPath,
        ['--enable-source-maps', 'dist/index.js', ...args],
        projectRoot(),
    );
}

export async function dev(): Promise<number> {
    print(`${badge('TYPESCRIPT')} Starting dev mode...\n\n`);
    const project = projectRoot();

    return await handOver(
        tsdown(project),
        [
            '--config',
            BUILD_PRESET,
            '--cwd',
            project,
            '--watch',
            '--on-success',
            'node --enable-source-maps dist/index.js',
        ],
        project,
    );
}

export function clean(): number {
    const artefacts = join(projectRoot(), '.artifacts');
    print(`${badge('TYPESCRIPT')} Removing artefacts...\n\n`);
    if (existsSync(artefacts)) {
        rmSync(artefacts, { force: true, recursive: true });
        print(`${GREEN}Removed .artifacts/${RESET}\n`);
    } else {
        print(`${GREEN}Nothing to remove — .artifacts/ is already absent${RESET}\n`);
    }

    return 0;
}
