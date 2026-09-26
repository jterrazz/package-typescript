import { resolve } from 'node:path';
import { stdout } from 'node:process';

import { entryPoints } from '../project/entry-points.js';
import { testPackageBin, testPackageVersion } from '../project/test-package.js';
import { workspaceMembers } from '../project/workspace-members.js';
import { readCommandLine } from './command-line.js';

// Prints nothing when no subpath resolves, and the caller keeps the preset's single `src/index.ts`.
export function entryPointsQuery(args) {
    for (const entry of entryPoints(resolve(args[0] ?? '.'))) {
        stdout.write(`${entry}\n`);
    }

    return 0;
}

export function testPackageQuery(args) {
    const commandLine = readCommandLine(args);
    const dir = commandLine.positionals[0] ?? '.';
    const answer = commandLine.has('--bin') ? testPackageBin(dir) : testPackageVersion(dir);
    if (answer === null) {
        return 1;
    }
    stdout.write(`${answer}\n`);

    return 0;
}

export function workspaceMembersQuery(args) {
    const members = workspaceMembers(args[0] ?? '.');
    if (members.length > 0) {
        stdout.write(`${members.join('\n')}\n`);
    }

    return 0;
}
