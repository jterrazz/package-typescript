import { lintTargets } from '../../../../lint/kit/project/lint-targets.js';
import { ignorePatternsOf } from '../../../../lint/kit/project/project-files.js';
import type { ProjectIdentity } from '../../../../lint/kit/project/project-kind.js';
import { workspaceMembers } from '../../../../lint/kit/project/workspace-members.js';
import { attwBinary } from '../../../drivers/attw/attw.js';
import { depcruiseBinary } from '../../../drivers/dependency-cruiser/dependency-cruiser.js';
import type { ToolConfig } from '../../../drivers/editor-config.js';
import { knipBinary } from '../../../drivers/knip/knip.js';
import { lsLintBinary } from '../../../drivers/ls-lint/ls-lint.js';
import { oxfmtBinary, oxfmtConfig } from '../../../drivers/oxfmt/oxfmt.js';
import { oxlintBinary, oxlintConfig, withTsgolintOnPath } from '../../../drivers/oxlint/oxlint.js';
import { prettierAstroPlugin, prettierBinary } from '../../../drivers/prettier/prettier.js';
import { publintBinary } from '../../../drivers/publint/publint.js';
import { rumdlBinary } from '../../../drivers/rumdl/rumdl.js';
import { tscBinary } from '../../../drivers/tsc/tsc.js';
import type { Logs } from '../report/logs.js';
import type { Selected } from './passes.js';

export type Tools = {
    attw: string;
    depcruise: string;
    knip: string;
    lsLint: string;
    oxfmt: string;
    oxlint: string;
    prettier: string;
    prettierAstroPlugin: string;
    publint: string;
    rumdl: string;
    tsc: string;
};

export type Targets = { nothing: boolean; paths: string[] };

export type ToolConfigs = { oxfmt: ToolConfig; oxlint: ToolConfig };

export type Check = {
    configs: ToolConfigs;
    declarations: ReadonlyMap<string, null | ProjectIdentity>;
    driftArgs: string[];
    fix: boolean;
    formatTargets: Targets;
    lintArgs: string[];
    lintTargets: Targets;
    logs: Logs;
    members: string[];
    selected: Selected;
    tools: Tools;
};

export const toolConfigs = (): ToolConfigs => ({ oxfmt: oxfmtConfig(), oxlint: oxlintConfig() });

export function toolsOf(): Tools {
    withTsgolintOnPath();

    return {
        attw: attwBinary(),
        depcruise: depcruiseBinary(),
        knip: knipBinary(),
        lsLint: lsLintBinary(),
        oxfmt: oxfmtBinary(),
        oxlint: oxlintBinary(),
        prettier: prettierBinary(),
        prettierAstroPlugin: prettierAstroPlugin(),
        publint: publintBinary(),
        rumdl: rumdlBinary(),
        tsc: tscBinary(),
    };
}

export function argumentsOf(args: readonly string[]): { driftArgs: string[]; lintArgs: string[] } {
    const lintArgs: string[] = [];
    const driftArgs: string[] = [];
    for (let index = 0; index < args.length; index += 1) {
        const argument = args[index];
        const pattern = args[index + 1];
        if (argument === '--ignore-pattern' && pattern !== undefined) {
            lintArgs.push(argument, pattern);
            index += 1;
        } else if (argument === '--json') {
            driftArgs.push(argument);
        }
    }

    return { driftArgs, lintArgs };
}

export async function targetsOf(
    lintArgs: readonly string[],
    { every, ignoresOf }: { every: boolean; ignoresOf: string | undefined },
): Promise<Targets> {
    try {
        const paths = await lintTargets('.', {
            every,
            ignorePatterns: ignorePatternsOf(lintArgs),
            ignoresOf,
        });

        return { nothing: paths.length === 0, paths };
    } catch {
        return { nothing: false, paths: [] };
    }
}

export function membersOf(): string[] {
    try {
        return workspaceMembers();
    } catch {
        return [];
    }
}
