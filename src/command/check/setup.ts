import { createRequire } from 'node:module';
import { join } from 'node:path';
import process from 'node:process';

import {
    binaryIn,
    HOISTED_BESIDE_PACKAGE,
    isExecutable,
    PACKAGE_ROOT,
} from '../../../lint/kit/project/package-root.js';
import { ignorePatternsOf } from '../../../lint/kit/project/project-files.js';
import { workspaceMembers } from '../../../lint/kit/project/workspace-members.js';
import { lintTargets } from '../lint-targets.js';
import type { ToolConfigs } from '../tool-configs.js';
import { tscIn, withTsgolintOnPath } from '../toolchain.js';
import type { Logs } from './logs.js';
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

export type Check = {
    configs: ToolConfigs;
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

export function projectBinary(name: string): string {
    const local = join(process.cwd(), 'node_modules/.bin', name);

    return isExecutable(local) ? local : binaryIn(name, HOISTED_BESIDE_PACKAGE);
}

function prettierAstroPlugin(): string {
    try {
        return createRequire(join(PACKAGE_ROOT, 'package.json')).resolve('prettier-plugin-astro');
    } catch {
        return '';
    }
}

function hoisted(name: string): string {
    return binaryIn(name, HOISTED_BESIDE_PACKAGE);
}

export function toolsOf(): Tools {
    withTsgolintOnPath(HOISTED_BESIDE_PACKAGE);

    return {
        attw: hoisted('attw'),
        depcruise: hoisted('depcruise'),
        knip: hoisted('knip'),
        lsLint: hoisted('ls-lint'),
        oxfmt: hoisted('oxfmt'),
        oxlint: hoisted('oxlint'),
        prettier: hoisted('prettier'),
        prettierAstroPlugin: prettierAstroPlugin(),
        publint: hoisted('publint'),
        rumdl: hoisted('rumdl'),
        tsc: tscIn(HOISTED_BESIDE_PACKAGE),
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
