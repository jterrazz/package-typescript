import { directory, file } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { onlyPasses } from '../_setup/check-passes.js';
import { emptyDirectories, OVERLOOKED } from '../_setup/names-empty-directory.js';
import { cli } from '../cli.specification.js';

// outside: git tracks no directory, so a fixture can carry no empty one.

const names = cli
    .with({ env: onlyPasses('names') })
    .fixture(directory('../_fixtures/names/empty-directories/'));

describe('names-empty-directory', () => {
    test('names each empty directory git does not ignore, once at its top, in four parts', async () => {
        // Given - a repository holding an empty folder, a folder of empty folders, and empty folders git ignores or never reads
        // When - the quality checks run
        const result = await names.prepare(emptyDirectories()).exec('check');

        // Then - the two empty trees are named at their top, each as a lesson, and nothing else is
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toMatch(file('../_expected/names-empty-directory/named.txt'));
    });

    test('names no empty directory an --ignore-pattern glob names', async () => {
        // Given - the same repository, with an empty folder under drafts/, which git does not ignore
        // When - the quality checks run with a glob naming drafts/
        const result = await names
            .prepare(emptyDirectories(OVERLOOKED))
            .exec("check --ignore-pattern 'drafts/**'");

        // Then - the two empty trees are named, and drafts/ is not
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toMatch(file('../_expected/names-empty-directory/named.txt'));
    });

    test('names the empty directories when a glob leaves git none to ignore', async () => {
        // Given - the same repository, with the one folder git ignores named by a glob
        // When - the quality checks run with that glob
        const result = await names
            .prepare(emptyDirectories())
            .exec("check --ignore-pattern 'local/**'");

        // Then - the two empty trees are named all the same
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toMatch(file('../_expected/names-empty-directory/named.txt'));
    });
});
