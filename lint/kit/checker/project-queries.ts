import { resolve } from 'node:path';
import { stdout } from 'node:process';

import { entryPoints } from '../project/entry-points.js';
import { testPackageVersion } from '../project/test-package.js';
import { workspaceMembers } from '../project/workspace-members.js';
import { readCommandLine } from './command-line.js';

// invariant: prints nothing when no subpath resolves, and the caller keeps the preset's single `src/index.ts`.
export function entryPointsQuery(args: readonly string[]): number {
    for (const [output, source] of Object.entries(entryPoints(resolve(args[0] ?? '.')))) {
        stdout.write(`${output} ${source}\n`);
    }

    return 0;
}

export function testPackageQuery(args: readonly string[]): number {
    const dir = readCommandLine(args).positionals[0] ?? '.';
    const answer = testPackageVersion(dir);
    if (answer === null) {
        return 1;
    }
    stdout.write(`${answer}\n`);

    return 0;
}

export function workspaceMembersQuery(args: readonly string[]): number {
    const members = workspaceMembers(args[0] ?? '.');
    if (members.length > 0) {
        stdout.write(`${members.join('\n')}\n`);
    }

    return 0;
}
