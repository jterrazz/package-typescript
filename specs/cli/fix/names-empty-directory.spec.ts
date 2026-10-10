import { directory, file } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { onlyPasses } from '../__setup__/check-passes.js';
import {
    EMPTY,
    emptyDirectories,
    KEPT,
    OVERLOOKED,
    verbatimDrafts,
} from '../__setup__/names-empty-directory.js';
import { cli } from '../cli.specification.js';

// outside: git tracks no directory, so a fixture can carry no empty one.

const names = cli
    .with({ env: onlyPasses('names') })
    .fixture(directory('../__fixtures__/names/empty-directories/'));

describe('names-empty-directory', () => {
    test('deletes each empty directory git does not ignore, and leaves the rest where it stands', async () => {
        // Given - a repository holding an empty folder, a folder of empty folders, and empty folders git ignores or never reads
        // When - the quality fixes run
        const result = await names.prepare(emptyDirectories()).exec('fix');

        // Then - the pass says what it removed and passes, the two empty trees are gone, and the ignored and unread folders stay
        expect(result.stdout).toMatch(file('../__expected__/names-empty-directory/removed.txt'));
        expect(
            [...EMPTY, 'src', ...KEPT].map((folder) => result.file(folder).exists),
        ).toStrictEqual([false, false, true, ...KEPT.map(() => true)]);
    });

    test('removes no empty directory under a root declared verbatim', async () => {
        // Given - that repository, with an empty folder under drafts/, a root its settings declare verbatim
        // When - the quality fixes run
        const result = await names
            .prepare(verbatimDrafts())
            .prepare(emptyDirectories(OVERLOOKED))
            .exec('fix');

        // Then - the two empty trees are removed, and drafts/wip stands
        expect(result.stdout).toMatch(file('../__expected__/names-empty-directory/removed.txt'));
        expect(result.file(OVERLOOKED).exists).toBe(true);
    });
});
