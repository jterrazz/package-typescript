import type { PrepareStep } from '@jterrazz/test';
import { mkdirSync, writeFileSync } from 'node:fs';
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

/** The settings file declaring `drafts/` verbatim, holding one note: the folder is kept as written, so an empty folder in it is its author's. */
export function verbatimDrafts(): PrepareStep {
    return (workdir) => {
        mkdirSync(join(workdir, 'drafts'), { recursive: true });
        writeFileSync(join(workdir, 'drafts/note.txt'), 'kept as written\n');
        writeFileSync(
            join(workdir, 'studio.config.ts'),
            "export default { typescript: { roots: { drafts: { reason: 'notes kept as written', verbatim: true } } } };\n",
        );
    };
}

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
