import { createHash } from 'node:crypto';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { MUTATION_OUTPUT } from '../../../lint/kit/project/build-plan.js';
import { listNotIgnored } from '../../../lint/kit/project/git-tree.js';
import { GROUND_FOLDERS, SETUP_FOLDER } from '../../../lint/kit/project/ground.js';

const READ_BY_TESTS = new Set([...GROUND_FOLDERS, SETUP_FOLDER]);

const isReadByTests = (path: string): boolean =>
    path
        .split('/')
        .slice(0, -1)
        .some((folder) => READ_BY_TESTS.has(folder));

function groundHashOf(project: string): string {
    const hash = createHash('sha256');
    // outside: the sweep that lists a project's files leaves a test's ground to its scenario, so the tree is asked of git directly.
    // Stryker disable next-line ArrayDeclaration: a name git did not list is no file on disk, so a stand-in entry is filtered out below whatever it holds
    const listed = listNotIgnored(project) ?? [];
    for (const path of listed
        // Stryker disable next-line ConditionalExpression,StringLiteral: an empty path has no folder, so it is no ground whether it is dropped here or by the check after it
        .filter((one) => one !== '' && isReadByTests(one) && existsSync(join(project, one)))
        .toSorted()) {
        hash.update(`${path}\0`);
        hash.update(readFileSync(join(project, path)));
    }

    return hash.digest('hex');
}

/**
 * Drops a stage's incremental report when the ground its tests read moved since it was written.
 * Stryker keys a test by its file's text, and cannot see a fixture, a golden or a setup file the test reads: a changed one left killed mutants reported as survivors, and the reverse kept a stale kill.
 * A cold start drops it whatever the ground did: a verdict a gate stands on is never inherited from an earlier run.
 */
export function incrementalKeptWhileGroundHolds(
    project: string,
    incremental: string,
    { cold = false }: { cold?: boolean } = {},
): void {
    const stamp = join(project, MUTATION_OUTPUT, `${incremental}.ground`);
    const file = join(project, MUTATION_OUTPUT, `${incremental}.json`);
    const current = groundHashOf(project);
    const held = !cold && existsSync(stamp) && String(readFileSync(stamp)) === current;
    if (!held) {
        rmSync(file, { force: true });
        writeFileSync(stamp, current);
    }
}
