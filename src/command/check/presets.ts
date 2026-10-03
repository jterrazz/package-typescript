import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import process from 'node:process';

import { readSettings } from '../../../lint/index.rules.js';
import { SETTINGS_FILE } from '../../../lint/kit/project/jterrazz-config.js';
import type { PresetChecker } from '../../../lint/kit/project/preset.js';
import { run } from '../processes.js';
import type { Stream } from '../processes.js';
import { checkerProgram } from '../toolchain.js';
import type { Launched } from './launched.js';
import { nearestPackageDir, specsRoots } from './project.js';
import type { Check } from './setup.js';

export type PresetRun = Launched & { label: string; root: boolean };

export async function presetCheckersOf(unit: string): Promise<PresetChecker[]> {
    const declaring = existsSync(join(unit, SETTINGS_FILE)) ? unit : '.';
    const { resolved } = await readSettings(declaring);

    return resolved.presets.flatMap(({ checker }) => (checker === undefined ? [] : [checker]));
}

export async function presetChecker(
    { module }: PresetChecker,
    args: readonly string[],
    stdout: Stream,
): Promise<number> {
    return await run(process.execPath, [checkerProgram(), '--preset', module, ...args], {
        stderr: 'stdout',
        stdout,
    });
}

type Planned = { args: string[]; checker: PresetChecker; root: boolean };

async function treeRuns(check: Check): Promise<Planned[]> {
    const planned = await Promise.all(
        specsRoots(check.members).map(async (root) => {
            const owner = nearestPackageDir(dirname(root));
            const checkers = owner === null ? [] : await presetCheckersOf(owner);

            return checkers.map((checker) => ({ args: [root], checker, root: false }));
        }),
    );

    return planned.flat();
}

async function memberRuns(check: Check): Promise<Planned[]> {
    const planned = await Promise.all(
        ['.', ...check.members].map(async (member) => {
            const checkers = await presetCheckersOf(member);

            return checkers.map((checker) => ({
                args: ['--member', member, ...(check.fix ? ['--fix'] : [])],
                checker,
                root: member === '.',
            }));
        }),
    );

    return planned.flat();
}

async function fixed(check: Check, planned: readonly Planned[]): Promise<PresetRun[]> {
    const runs: PresetRun[] = [];
    for (const [index, { args, checker, root }] of planned.entries()) {
        const log = check.logs.at(`preset-${String(index)}.log`);
        // oxlint-disable-next-line no-await-in-loop -- each run writes files the next one reads
        const status = await presetChecker(checker, args, { path: log });
        runs.push({ label: checker.label, log, root, status: Promise.resolve(status) });
    }

    return runs;
}

export async function presetRuns(check: Check): Promise<PresetRun[]> {
    if (!check.selected('presets')) {
        return [];
    }
    const planned = [...(check.fix ? [] : await treeRuns(check)), ...(await memberRuns(check))];
    if (check.fix) {
        return await fixed(check, planned);
    }

    return planned.map(({ args, checker, root }, index) => {
        const log = check.logs.at(`preset-${String(index)}.log`);

        return {
            label: checker.label,
            log,
            root,
            status: presetChecker(checker, args, { path: log }),
        };
    });
}
