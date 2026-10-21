import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

import { MUTATION_OUTPUT } from '../../../lint/kit/project/build-plan.js';
import {
    IN_PROCESS_VARIABLE,
    OBSERVED_TESTS_VARIABLE,
    RAN_BY_TESTS_VARIABLE,
} from './mutant-setup.js';

/** The folders a stage's test files write what they ran into, each named to them by its variable. */
export type RecordFolders = { inProcess: string; observed: string; ranByTests: string };

const madeIn = (project: string, prefix: string): string =>
    mkdtempSync(join(project, MUTATION_OUTPUT, prefix));

/** Makes a stage's record folders under the project's mutation output, and names each to the processes its run starts. */
export function recordFoldersMade(project: string): RecordFolders {
    const folders = {
        inProcess: madeIn(project, 'in-process-'),
        observed: madeIn(project, 'observed-tests-'),
        ranByTests: madeIn(project, 'ran-by-tests-'),
    };
    process.env[IN_PROCESS_VARIABLE] = folders.inProcess;
    process.env[OBSERVED_TESTS_VARIABLE] = folders.observed;
    process.env[RAN_BY_TESTS_VARIABLE] = folders.ranByTests;

    return folders;
}

/** The mutants the test files wrote into a folder, one per line of each file. */
export const linesIn = (folder: string): Set<string> =>
    new Set(
        readdirSync(folder).flatMap((name) => String(readFileSync(join(folder, name))).split('\n')),
    );

/** Removes a stage's record folders once its run has been read. */
export function recordFoldersRemoved(folders: RecordFolders): void {
    for (const folder of Object.values(folders)) {
        rmSync(folder, { recursive: true });
    }
}
