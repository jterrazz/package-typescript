import { lstatSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';

import { MUTATION_OUTPUT } from '../../../lint/kit/project/build-plan.js';
import { isRepositoryRoot, nearestRoot } from '../../../lint/kit/project/repository-root.js';

/** The folders of the repository a member's specs reach by climbing out of it: where the sandbox's copy stands, and the names to lay beside it. */
export type Beside = { levels: number; names: readonly string[]; root: string };

/** How many folders the sandbox lies below its member, `.artifacts/stryker/tmp/sandbox-*`. */
export const SANDBOX_DEPTH = 4;

// invariant: a workspace member is mutated from its own folder, and its specs may climb out of it to the repository's files; a project that is the repository's own root has nothing above it to lay.
export function besideOf(project: string): Beside | undefined {
    const root = isRepositoryRoot(resolve(project))
        ? undefined
        : nearestRoot(dirname(resolve(project)), isRepositoryRoot);
    if (root === undefined) {
        return undefined;
    }

    return {
        levels: relative(root, resolve(project)).split(sep).length,
        names: readdirSync(root)
            .filter((name) => !name.startsWith('.') && name !== 'node_modules')
            .toSorted(),
        root,
    };
}

// invariant: the links a sandbox lays beside its copy outlive the run when they land in the member's own `.artifacts/`, and each points at a repository folder holding that `.artifacts/` again; a walker that follows links (ls-lint, in the Names pass) loops on them for ever, so the run takes them away when it ends, and before it starts, for those a killed run left.
export function besideLinksDropped(project: string, beside: Beside | undefined): void {
    if (beside === undefined || beside.levels < 1 || beside.levels >= SANDBOX_DEPTH) {
        return;
    }
    const laid = resolve(project, MUTATION_OUTPUT, 'tmp', 'sandbox', '../'.repeat(beside.levels));
    for (const name of beside.names) {
        const link = join(laid, name);
        if (lstatSync(link, { throwIfNoEntry: false })?.isSymbolicLink() === true) {
            rmSync(link);
        }
    }
}

/** Runs `run` with the links of the sandbox gone before it starts, for those a killed run left, and after it ends. */
export async function withoutBesideLinks<T>(
    project: string,
    beside: Beside | undefined,
    run: () => Promise<T>,
): Promise<T> {
    besideLinksDropped(project, beside);
    const result = await run();
    besideLinksDropped(project, beside);

    return result;
}
