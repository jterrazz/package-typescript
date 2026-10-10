import { directory, file } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { onlyPasses } from '../__setup__/check-passes.js';
import {
    emptyDirectories,
    OVERLOOKED,
    verbatimDrafts,
} from '../__setup__/names-empty-directory.js';
import { cli } from '../cli.specification.js';

// outside: git tracks no directory, so a fixture can carry no empty one.

const names = cli
    .with({ env: onlyPasses('names') })
    .fixture(directory('../__fixtures__/names/empty-directories/'));

describe('names-empty-directory', () => {
    test('names each empty directory git does not ignore, once at its top, in four parts', async () => {
        // Given - a repository holding an empty folder, a folder of empty folders, and empty folders git ignores or never reads
        // When - the quality checks run
        const result = await names.prepare(emptyDirectories()).exec('check');

        // Then - the two empty trees are named at their top, each as a lesson, and nothing else is
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toMatch(file('../__expected__/names-empty-directory/named.txt'));
    });

    test('names no empty directory under a root declared verbatim', async () => {
        // Given - the same repository, with an empty folder under drafts/, a root its settings declare verbatim
        // When - the quality checks run
        const result = await names
            .prepare(verbatimDrafts())
            .prepare(emptyDirectories(OVERLOOKED))
            .exec('check');

        // Then - the two empty trees are named, and drafts/ is not
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toMatch(file('../__expected__/names-empty-directory/named.txt'));
    });
});
