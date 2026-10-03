import { join } from 'node:path';
import process from 'node:process';

import { BASELINE } from '../../lint/kit/baseline/baseline-file.js';
import {
    OXLINT_SUPPRESSIONS,
    removeWhenEmpty,
    withStagedSuppressions,
} from '../../lint/kit/baseline/oxlint-suppressions.js';
import { binaryIn, HOISTED_BESIDE_PACKAGE } from '../../lint/kit/project/package-root.js';
import { ignorePatternsOf } from '../../lint/kit/project/project-files.js';
import { debtHoldingCheckersOf, presetChecker } from './check/presets.js';
import { checker } from './checker.js';
import { lintTargets } from './lint-targets.js';
import { run } from './processes.js';
import { inScratch } from './scratch.js';
import { badge, print } from './terminal.js';
import { toolConfigs } from './tool-configs.js';
import { projectRoot, withTsgolintOnPath } from './toolchain.js';

async function listedTargets(
    ignoresOf: string | undefined,
    args: readonly string[],
): Promise<null | string[]> {
    try {
        return await lintTargets('.', { ignorePatterns: ignorePatternsOf(args), ignoresOf });
    } catch {
        return null;
    }
}

async function recordLinter(args: readonly string[], projectBin: string): Promise<void> {
    const { oxlint } = toolConfigs();
    const targets = await listedTargets(oxlint.ignoresOf, args);
    if (targets === null || targets.length === 0) {
        return;
    }
    for (const recording of ['--suppress-all', '--prune-suppressions']) {
        await run(
            binaryIn('oxlint', projectBin),
            [...oxlint.args, '--type-aware', recording, ...args, ...targets],
            { stderr: 'ignore', stdout: 'ignore' },
        );
    }
    removeWhenEmpty('.');
}

async function recordPass(pass: string, report: string, args: readonly string[]): Promise<void> {
    await checker(
        pass,
        ['.', '--format', 'json', ...args],
        { path: report },
        { stderr: 'ignore', typeless: true },
    );
}

type Reports = { architecture: string; names: string };

async function written(reports: Reports): Promise<number> {
    return await checker(
        'baseline',
        ['.', '--architecture', reports.architecture, '--names', reports.names, '--write'],
        'inherit',
        { stderr: 'inherit' },
    );
}

async function recordedPresets(): Promise<number> {
    for (const contributed of await debtHoldingCheckersOf('.')) {
        if ((await presetChecker(contributed, ['baseline'], 'inherit')) !== 0) {
            return 1;
        }
    }

    return 0;
}

export async function baseline(args: readonly string[]): Promise<number> {
    const project = projectRoot();
    process.chdir(project);
    const projectBin = join(project, 'node_modules/.bin');
    withTsgolintOnPath(projectBin);

    return await withStagedSuppressions(
        project,
        async () =>
            await inScratch(async (scratch) => {
                const reports: Reports = {
                    architecture: join(scratch, 'architecture.json'),
                    names: join(scratch, 'names.json'),
                };
                print(`${badge('TYPESCRIPT')} Recording the baseline...\n\n`);
                await recordLinter(args, projectBin);
                await recordPass('architecture', reports.architecture, [
                    '--depcruise',
                    binaryIn('depcruise', HOISTED_BESIDE_PACKAGE),
                    ...args,
                ]);
                await recordPass('names', reports.names, [
                    '--ls-lint',
                    binaryIn('ls-lint', HOISTED_BESIDE_PACKAGE),
                    ...args,
                ]);
                if ((await written(reports)) !== 0 || (await recordedPresets()) !== 0) {
                    return 1;
                }
                await run(
                    binaryIn('oxfmt', projectBin),
                    [
                        ...toolConfigs().oxfmt.args,
                        '--no-error-on-unmatched-pattern',
                        BASELINE,
                        OXLINT_SUPPRESSIONS,
                    ],
                    {
                        stderr: 'ignore',
                        stdout: 'ignore',
                    },
                );

                return 0;
            }),
    );
}
