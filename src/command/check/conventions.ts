import { dirname } from 'node:path';
import process from 'node:process';

import { testPackageBin } from '../../../lint/engine/project/test-package.js';
import { run } from '../processes.js';
import type { Launched } from './launched.js';
import { nearestPackageDir, specsRoots, usesTestPackage } from './project.js';
import type { Check } from './setup.js';

type Member = { bin: string; member: string };

export function checkerMembers(check: Check): Member[] {
    if (check.fix || !check.selected('conventions')) {
        return [];
    }

    return ['.', ...check.members].flatMap((member) => {
        const bin = testPackageBin(member);

        return bin === null ? [] : [{ bin, member }];
    });
}

function specsRuns(check: Check): Launched[] {
    if (check.fix || !check.selected('conventions')) {
        return [];
    }

    return specsRoots(check.members).flatMap((root, index) => {
        const owner = nearestPackageDir(dirname(root));
        if (owner === null || !usesTestPackage(owner)) {
            return [];
        }
        const bin = testPackageBin(owner);
        const [command, args] =
            bin === null ? [check.tools.checker, [root]] : [process.execPath, [bin, root]];
        const log = check.logs.at(`checker-${String(index)}.log`);

        return [{ log, status: run(command, args, { stderr: 'stdout', stdout: { path: log } }) }];
    });
}

function memberRuns(
    check: Check,
    members: readonly Member[],
): { launched: Launched[]; rootLog: string | undefined } {
    let rootLog: string | undefined;
    const launched = members.map(({ bin, member }, index) => {
        const log = check.logs.at(`checker-member-${String(index)}.log`);
        rootLog = member === '.' ? log : rootLog;
        const args = [bin, '--member', member, '--oxlint-report', check.logs.at('lint.json')];

        return {
            log,
            status: run(process.execPath, args, { stderr: 'stdout', stdout: { path: log } }),
        };
    });

    return { launched, rootLog };
}

export type Conventions = { rootLog: string | undefined; runs: Launched[] };

export async function conventions(
    check: Check,
    members: readonly Member[],
    lint: Promise<number>,
): Promise<Conventions> {
    const specs = specsRuns(check);
    if (members.length > 0) {
        await lint;
    }
    const { launched, rootLog } = memberRuns(check, members);

    return { rootLog, runs: [...specs, ...launched] };
}
