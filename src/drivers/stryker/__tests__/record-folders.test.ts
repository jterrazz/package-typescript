import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import process from 'node:process';
import { describe, expect, onTestFinished, test, vi } from 'vitest';

import { MUTATION_OUTPUT } from '../../../../lint/kit/project/build-plan.js';
import {
    IN_PROCESS_VARIABLE,
    OBSERVED_TESTS_VARIABLE,
    RAN_BY_TESTS_VARIABLE,
} from '../mutant-setup.js';
import { recordFoldersMade, recordFoldersRemoved } from '../record-folders.js';

function projectWithOutput(): string {
    const project = mkdtempSync(join(tmpdir(), 'record-folders-'));
    mkdirSync(join(project, MUTATION_OUTPUT), { recursive: true });
    onTestFinished(() => {
        rmSync(project, { force: true, recursive: true });
    });

    return project;
}

function recordVariablesStubbed(): void {
    vi.stubEnv(IN_PROCESS_VARIABLE, '');
    vi.stubEnv(OBSERVED_TESTS_VARIABLE, '');
    vi.stubEnv(RAN_BY_TESTS_VARIABLE, '');
    onTestFinished(() => {
        vi.unstubAllEnvs();
    });
}

describe('record folders', () => {
    test('recordFoldersMade — three folders under the mutation output, each named for what it records and named to the run by its variable', () => {
        // Given - a project with its mutation output, and the three variables stubbed so the test restores them
        const project = projectWithOutput();
        recordVariablesStubbed();

        // When - a stage's record folders are made
        const folders = recordFoldersMade(project);

        // Then - each lies in the output, its name its prefix and a random suffix, and its variable names it
        const named = Object.entries(folders).map(([key, folder]) => [
            key,
            dirname(folder) === join(project, MUTATION_OUTPUT),
            basename(folder).slice(0, -6),
        ]);
        expect(named).toStrictEqual([
            ['inProcess', true, 'in-process-'],
            ['observed', true, 'observed-tests-'],
            ['ranByTests', true, 'ran-by-tests-'],
        ]);
        expect([
            process.env[IN_PROCESS_VARIABLE],
            process.env[OBSERVED_TESTS_VARIABLE],
            process.env[RAN_BY_TESTS_VARIABLE],
        ]).toStrictEqual([folders.inProcess, folders.observed, folders.ranByTests]);
    });

    test('recordFoldersRemoved — every record folder is gone once the run is read', () => {
        // Given - a stage's three record folders
        const project = projectWithOutput();
        recordVariablesStubbed();
        const folders = recordFoldersMade(project);

        // When - they are removed
        recordFoldersRemoved(folders);

        // Then - none of them is left
        expect(Object.values(folders).map((folder) => existsSync(folder))).toStrictEqual([
            false,
            false,
            false,
        ]);
    });
});
