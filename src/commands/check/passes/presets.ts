import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { readSettings } from '../../../../lint/index.rules.js';
import { SETTINGS_FILE } from '../../../../lint/kit/project/jterrazz-config.js';
import type { PresetChecker } from '../../../../lint/kit/project/preset.js';
import { presetChecker } from '../../../drivers/checker/checker.js';
import type { Launched } from './launched.js';
import type { Check } from './setup.js';

export type PresetRun = Launched & { label: string; root: boolean };

async function presetCheckersOf(unit: string): Promise<PresetChecker[]> {
    const { resolved } = await readSettings(unit);

    return resolved.presets.flatMap(({ checker }) => (checker === undefined ? [] : [checker]));
}

type Planned = { args: string[]; checker: PresetChecker; root: boolean };

async function planned(check: Check): Promise<Planned[]> {
    const fixing = check.fix ? ['--fix'] : [];
    const declaring = check.members.filter((member) => existsSync(join(member, SETTINGS_FILE)));
    const units = await Promise.all(
        ['.', ...declaring].map(async (unit) => {
            const checkers = await presetCheckersOf(unit);

            return checkers.map((checker) => ({
                args: unit === '.' ? fixing : ['--member', unit, ...fixing],
                checker,
                root: unit === '.',
            }));
        }),
    );

    return units.flat();
}

async function fixed(check: Check, runs: readonly Planned[]): Promise<PresetRun[]> {
    const done: PresetRun[] = [];
    for (const [index, { args, checker, root }] of runs.entries()) {
        const log = check.logs.at(`preset-${String(index)}.log`);
        const status = await presetChecker(checker, args, { path: log });
        done.push({ label: checker.label, log, root, status: Promise.resolve(status) });
    }

    return done;
}

export async function presetRuns(check: Check): Promise<PresetRun[]> {
    if (!check.selected('presets')) {
        return [];
    }
    const runs = await planned(check);
    if (check.fix) {
        return await fixed(check, runs);
    }

    return runs.map(({ args, checker, root }, index) => {
        const log = check.logs.at(`preset-${String(index)}.log`);

        return {
            label: checker.label,
            log,
            root,
            status: presetChecker(checker, args, { path: log }),
        };
    });
}
