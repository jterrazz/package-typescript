import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { MUTATION_OUTPUT } from '../../../lint/kit/project/build-plan.js';
import { CHILD_COVERAGE_SOURCE } from './child-coverage.js';
import { ignorersSource } from './ignorers.js';
import { MUTANT_SETUP_SOURCE } from './mutant-setup.js';
import { PROGRESS_REPORTER_SOURCE } from './progress-reporter.js';
import { IGNORERS_FILE, REPORTER_FILE } from './stryker.js';

/** Lays in the project the files every stage of the run loads, the presentation globs its ignorers read among them. */
export function strykerPrepared(project: string, presentation: readonly string[]): void {
    mkdirSync(join(project, MUTATION_OUTPUT), { recursive: true });
    writeFileSync(join(project, MUTATION_OUTPUT, 'mutant-setup.mjs'), MUTANT_SETUP_SOURCE);
    writeFileSync(join(project, MUTATION_OUTPUT, 'child-coverage.cjs'), CHILD_COVERAGE_SOURCE);
    writeFileSync(join(project, REPORTER_FILE), PROGRESS_REPORTER_SOURCE);
    writeFileSync(join(project, IGNORERS_FILE), ignorersSource(presentation));
}
