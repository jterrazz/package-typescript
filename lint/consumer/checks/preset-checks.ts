import { resolve } from 'node:path';

import { contextOf } from '../../engine/checker/checker.js';
import { readCommandLine } from '../../engine/checker/command-line.js';
import type { Context, Finding } from '../../engine/checker/pass.js';
import { binaryIn, HOISTED_BESIDE_PACKAGE } from '../../engine/project/package-root.js';
import { resolveConfig } from '../../engine/project/preset.js';
import type { Preset } from '../../engine/project/preset.js';
import { workspaceMembers } from '../../engine/project/workspace-members.js';
import { architecture } from './architecture.js';
import { declaredNamesFindings, declaredNamesRules } from './names.declared.js';

export type PresetChecks = {
    findings: Finding[];
    problems: string[];
};

async function declaredNames(context: Context): Promise<PresetChecks> {
    const declared = declaredNamesRules(await context.config());
    if (declared.problem !== null) {
        return { findings: [], problems: [declared.problem] };
    }
    const { findings, problems } = declaredNamesFindings(context, {
        rules: declared.rules,
        swept: context.files(),
        units: ['', ...workspaceMembers(context.root).map((member) => `${member}/`)],
    });

    return { findings, problems };
}

export async function presetChecks(
    root: string,
    { base, config }: { base: readonly Preset[]; config: object },
): Promise<PresetChecks> {
    const tree = resolve(root);
    const settings = resolveConfig(config, base);
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
    if (settings.problem !== null) {
        return { findings: [], problems: [settings.problem] };
    }
    const [layers, names] = await Promise.all([architecture.check(context), declaredNames(context)]);

    return {
        findings: [...(layers.findings ?? []), ...names.findings],
        problems: [...(layers.failed === true ? (layers.lines ?? []) : []), ...names.problems],
    };
}
