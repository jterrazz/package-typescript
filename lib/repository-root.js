#!/usr/bin/env node

/**
 * Where one repository ends, for every gate that walks upward.
 *
 * A gate that reads a file above the project it runs in — the artefact gate
 * looking for the workspace `.gitignore`, the dependency walk looking for an
 * installed package — must stop somewhere, and the only honest stop is the
 * repository. A clone checked out INSIDE another tree (a workbench under
 * `home/<brand>/work/`, a vendored dependency) is not a member of the tree it
 * happens to sit in, and what lies above answers for a project whose files are
 * none of this one's business.
 *
 * `.git` is that boundary in both spellings it takes: a DIRECTORY in a clone,
 * a FILE in a worktree.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';

/** Whether `dir` is a repository root — a `.git` beside it, file or directory. */
export function isRepositoryRoot(dir) {
    return existsSync(join(dir, '.git'));
}
