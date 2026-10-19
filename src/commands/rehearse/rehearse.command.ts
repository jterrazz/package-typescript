import process from 'node:process';

import { refusal } from '../../../lint/kit/catalogue/lesson.js';
import type { ChapterAnchor } from '../../../lint/kit/catalogue/lesson.js';
import { readCommandLine } from '../../../lint/kit/checker/command-line.js';
import { git } from '../../../lint/kit/project/git.js';
import { dockerRun } from '../../drivers/docker/docker.js';
import { badge, print, RED, RESET } from '../check/report/terminal.js';
import {
    branchOf,
    bunOf,
    drivesBrowser,
    gitDirectoryOf,
    IMAGE,
    installerOf,
    rehearsalOf,
    TARGETS,
    tracksGo,
} from './rehearsal.js';
import type { Facts } from './rehearsal.js';

const READ: ChapterAnchor = 'docs/reference/commands.md#a-rehearsal-on-linux';

const WHY =
    'the rehearsal runs the gate on a fresh clone of a committed branch, installed from its lockfile, as the runner that publishes the release does';

function factsOf(args: readonly string[]): Facts | string {
    const commandLine = readCommandLine(args, ['--branch', '--targets']);
    const root = git(process.cwd(), ['rev-parse', '--show-toplevel'])?.trim();
    const gitDirectory = root === undefined ? undefined : gitDirectoryOf(root);
    if (root === undefined || gitDirectory === undefined) {
        return refusal({
            fix: 'run it from a clone or a worktree of the repository',
            found: `${process.cwd()} is in no git repository`,
            read: READ,
            why: WHY,
        });
    }
    const branch = commandLine.value('--branch') ?? branchOf(root);
    if (branch === undefined) {
        return refusal({
            fix: 'check out the branch to rehearse, or name it with --branch <name>',
            found: 'the checkout stands on no branch',
            read: READ,
            why: WHY,
        });
    }
    const installer = installerOf(root);
    if (installer === undefined) {
        return refusal({
            fix: 'commit the lockfile the package manager writes (package-lock.json, bun.lock or pnpm-lock.yaml)',
            found: `${root} holds no lockfile`,
            read: READ,
            why: WHY,
        });
    }

    return {
        branch,
        browser: drivesBrowser(root),
        bun: bunOf(root),
        gitDirectory,
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
