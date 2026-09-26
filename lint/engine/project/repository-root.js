import { existsSync } from 'node:fs';
import { join } from 'node:path';

export function isRepositoryRoot(dir) {
    // `.git` is a directory in a clone and a file in a worktree.
    return existsSync(join(dir, '.git'));
}
