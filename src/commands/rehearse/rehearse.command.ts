import process from 'node:process';

import { refusal } from '../../../lint/kit/catalogue/lesson.js';
import { readCommandLine } from '../../../lint/kit/checker/command-line.js';
import { dockerRun } from '../../drivers/docker/docker.js';
import { badge, print, RED, RESET } from '../terminal.js';
import {
    branchOf,
    bunOf,
    checkoutRootOf,
    drivesBrowser,
    gitDirectoryOf,
    IMAGE,
    installerOf,
    rehearsalOf,
    TARGETS,
    tracksGo,
} from './rehearsal.js';
import type { Facts } from './rehearsal.js';

const WHY =
    'the rehearsal runs the gate on a fresh clone of a committed branch, installed from its lockfile, as the runner that publishes the release does';

function factsOf(args: readonly string[]): Facts | string {
    const commandLine = readCommandLine(args, ['--branch', '--targets']);
    const root = checkoutRootOf(process.cwd());
    if (root === undefined) {
        return refusal({
            fix: 'run it from a clone or a worktree of the repository',
            found: `${process.cwd()} is in no git repository`,
            read: 'docs/reference/commands.md#a-rehearsal-on-linux',
            why: WHY,
        });
    }
    const branch = commandLine.value('--branch') ?? branchOf(root);
    if (branch === undefined) {
        return refusal({
            fix: 'check out the branch to rehearse, or name it with --branch <name>',
            found: 'the checkout stands on no branch',
            read: 'docs/reference/commands.md#a-rehearsal-on-linux',
            why: WHY,
        });
    }
    const installer = installerOf(root);
    if (installer === undefined) {
        return refusal({
            fix: 'commit the lockfile the package manager writes (package-lock.json, bun.lock or pnpm-lock.yaml)',
            found: `${root} holds no lockfile`,
            read: 'docs/reference/commands.md#a-rehearsal-on-linux',
            why: WHY,
        });
    }

    return {
        branch,
        browser: drivesBrowser(root),
        bun: bunOf(root),
        gitDirectory: gitDirectoryOf(root),
        go: tracksGo(root),
        installer,
        root,
        targets: commandLine.value('--targets') ?? TARGETS,
    };
}

export async function rehearse(args: readonly string[]): Promise<number> {
    const facts = factsOf(args);
    if (typeof facts === 'string') {
        print(`${RED}${facts}${RESET}\n`);

        return 1;
    }
    print(
        `${badge('TYPESCRIPT')} Rehearsing ${facts.branch} on Linux: a fresh clone in ${IMAGE}, \`make ${facts.targets}\` as a GitHub runner runs it...\n\n`,
    );

    return await dockerRun(rehearsalOf(facts));
}
