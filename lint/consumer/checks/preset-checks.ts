import { resolve } from 'node:path';

import { contextOf } from '../../engine/checker/checker.js';
import { readCommandLine } from '../../engine/checker/command-line.js';
import type { Finding, Pass } from '../../engine/checker/pass.js';
import { binaryIn, HOISTED_BESIDE_PACKAGE } from '../../engine/project/package-root.js';
import { resolveConfig } from '../../engine/project/preset.js';
import type { Preset } from '../../engine/project/preset.js';
import { architecture } from './architecture.js';
import { names } from './names.js';

export type PresetChecks = {
    findings: Finding[];
    problems: string[];
};

const PRESET_PASSES: readonly Pass[] = [architecture, names];

export async function presetChecks(
    root: string,
    { base, presets }: { base: readonly Preset[]; presets: readonly Preset[] },
): Promise<PresetChecks> {
    const tree = resolve(root);
    const settings = resolveConfig({ presets }, base);
    const read = contextOf(
        readCommandLine(
            [
                tree,
                '--depcruise',
                binaryIn('depcruise', HOISTED_BESIDE_PACKAGE),
                '--ls-lint',
                binaryIn('ls-lint', HOISTED_BESIDE_PACKAGE),
            ],
            ['--depcruise', '--ls-lint'],
        ),
        base,
    );
    const context = {
        ...read,
        config: async (unit?: string) =>
            unit === undefined || resolve(unit) === tree ? settings : await read.config(unit),
    };
    const results = await Promise.all(PRESET_PASSES.map(async (pass) => await pass.check(context)));

    return {
        findings: results.flatMap((result) => result.findings ?? []),
        problems: [
            ...(settings.problem === null ? [] : [settings.problem]),
            ...results.flatMap((result) => (result.failed === true ? (result.lines ?? []) : [])),
        ],
    };
}
