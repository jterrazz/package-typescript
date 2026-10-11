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
import { checker, presetChecker } from '../../drivers/checker/checker.js';
import { depcruiseBinary } from '../../drivers/dependency-cruiser/dependency-cruiser.js';
import { lsLintBinary } from '../../drivers/ls-lint/ls-lint.js';
import { filesFormatted, oxfmtBinary, oxfmtConfig } from '../../drivers/oxfmt/oxfmt.js';
import {
    oxlintBinary,
    oxlintConfig,
    suppressionsRecorded,
    withTsgolintOnPath,
} from '../../drivers/oxlint/oxlint.js';
import { verbatimHere } from '../check/passes/setup.js';
import { badge, print } from '../check/report/terminal.js';

async function listedTargets(ignoresOf: string | undefined): Promise<null | string[]> {
    try {
        return await lintTargets('.', { ignorePatterns: await verbatimHere(), ignoresOf });
    } catch {
        return null;
    }
}

async function recordLinter(): Promise<void> {
    const oxlint = oxlintConfig();
    const targets = await listedTargets(oxlint.ignoresOf);
    if (targets === null || targets.length === 0) {
        return;
    }
    await suppressionsRecorded(oxlintBinary(), oxlint.args, targets);
    // Stryker disable next-line StringLiteral: the root and an empty name resolve to the working directory alike
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

export async function baseline(): Promise<number> {
    const project = process.cwd();
    // invariant: the tools are found as `check` finds them — beside this package, then hoisted beside the workspace root — so the gesture the adopt flow prescribes reads the same oxlint in a member.
    // Stryker disable next-line CallExpression: the call lays the hoisted tsgolint on the PATH, and where this package installed its own it is found already, which is where every spec of this repository runs
    withTsgolintOnPath();

    return await withStagedSuppressions(
        project,
        async () =>
            await inScratch(async (scratch) => {
                const reports: Reports = {
                    architecture: join(scratch, 'architecture.json'),
                    names: join(scratch, 'names.json'),
                };
                print(`${badge('TYPESCRIPT')} Recording the baseline...\n\n`);
                await recordLinter();
                await recordPass('architecture', reports.architecture, [
                    '--depcruise',
                    depcruiseBinary(),
                ]);
                await recordPass('names', reports.names, ['--ls-lint', lsLintBinary()]);
                if ((await written(reports)) !== 0 || (await recordedPresets()) !== 0) {
                    return 1;
                }
                await filesFormatted(
                    oxfmtBinary(),
                    oxfmtConfig().args,
                    BASELINE,
                    OXLINT_SUPPRESSIONS,
                );

                return 0;
            }),
    );
}
