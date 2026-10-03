import type { PrepareStep } from '@jterrazz/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { repository } from './repository.js';

export const EMPTY = ['src/abandoned', 'src/scaffold/domain/entities'];

export const KEPT = [
    '.artifacts/tsc',
    '.next/cache',
    '.turbo/cache',
    '.vite/deps',
    'coverage/tmp',
    'dist/types',
    'local/draft',
    'node_modules/stale',
    'vendor/.git',
];

export const OVERLOOKED = 'drafts/wip';

/** A repository indexing a tree that holds an empty src/scaffold/, then empty folders git does not ignore, ignores, or never reads. */
export function emptyDirectories(...more: string[]): PrepareStep {
    return (workdir) => {
        mkdirSync(join(workdir, 'src/scaffold'));
        repository(workdir);
        for (const folder of [...EMPTY, ...KEPT, ...more]) {
            mkdirSync(join(workdir, folder), { recursive: true });
        }
    };
}
