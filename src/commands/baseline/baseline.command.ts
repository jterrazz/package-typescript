import { join } from 'node:path';
import process from 'node:process';

import { readSettings } from '../../../lint/index.rules.js';
import { BASELINE } from '../../../lint/kit/baseline/baseline-file.js';
import {
    OXLINT_SUPPRESSIONS,
    removeWhenEmpty,
    withStagedSuppressions,
} from '../../../lint/kit/baseline/oxlint-suppressions.js';
import { inScratch } from '../../../lint/kit/checker/ending.js';
import { lintTargets } from '../../../lint/kit/project/lint-targets.js';
import type { PresetChecker } from '../../../lint/kit/project/preset.js';
import { ignorePatternsOf } from '../../../lint/kit/project/project-files.js';
import { checker, presetChecker } from '../../drivers/checker/checker.js';
import { depcruiseBinary } from '../../drivers/dependency-cruiser/dependency-cruiser.js';
import { lsLintBinary } from '../../drivers/ls-lint/ls-lint.js';
import { oxfmtBinary, oxfmtConfig, runOxfmt } from '../../drivers/oxfmt/oxfmt.js';
import {
    oxlintBinary,
    oxlintConfig,
    runOxlint,
    withTsgolintOnPath,
} from '../../drivers/oxlint/oxlint.js';
import { badge, print } from '../check/report/terminal.js';

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
    const oxlint = oxlintConfig();
    const targets = await listedTargets(oxlint.ignoresOf, args);
    if (targets === null || targets.length === 0) {
        return;
    }
    for (const recording of ['--suppress-all', '--prune-suppressions']) {
        await runOxlint(
            oxlintBinary(projectBin),
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

async function debtHoldingCheckersOf(unit: string): Promise<PresetChecker[]> {
    const { resolved } = await readSettings(unit);

    return resolved.presets.flatMap(({ baseline: sections = [], checker: contributed }) =>
        contributed === undefined || sections.length === 0 ? [] : [contributed],
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
    const project = process.cwd();
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
                    depcruiseBinary(),
                    ...args,
                ]);
                await recordPass('names', reports.names, ['--ls-lint', lsLintBinary(), ...args]);
                if ((await written(reports)) !== 0 || (await recordedPresets()) !== 0) {
                    return 1;
                }
                await runOxfmt(
                    oxfmtBinary(projectBin),
                    [
                        ...oxfmtConfig().args,
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
