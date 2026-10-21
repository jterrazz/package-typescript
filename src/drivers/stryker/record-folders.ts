import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

import { MUTATION_OUTPUT } from '../../../lint/kit/project/build-plan.js';
import { isList, objectOf } from '../../../lint/kit/project/json.js';
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

/** One test as the dry run saw it, by its key; a test with neither list is one the run could not follow into every process it spawned. */
export type ObservedTest = {
    loaded?: readonly string[] | undefined;
    ran?: readonly string[] | undefined;
    test: string;
};

const sourcesListed = (sources: unknown): string[] | undefined =>
    isList(sources) ? sources.map(String) : undefined;

function observedTestOf(value: unknown): ObservedTest {
    const { loaded, ran, test } = objectOf(value);

    return { loaded: sourcesListed(loaded), ran: sourcesListed(ran), test: String(test) };
}

/** Every test the dry run's processes wrote into the folder, as they wrote it. */
export function observedIn(folder: string): ObservedTest[] {
    return readdirSync(folder).flatMap((name) => {
        const text = String(readFileSync(join(folder, name)));
        const records: unknown = JSON.parse(text);

        return isList(records) ? records.map((record) => observedTestOf(record)) : [];
    });
}
