import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, onTestFinished, test } from 'vitest';

import { PROGRESS_REPORTER, PROGRESS_REPORTER_SOURCE } from '../progress-reporter.js';

type Tested = { id: string; status: string };

const PLANNED = [
    ...Array.from({ length: 20 }, (_, index) => ({ mutant: { id: String(index) }, plan: 'Run' })),
    { mutant: { id: 'early' }, plan: 'EarlyResult' },
];

const EVERY_THIRD_SURVIVES: Tested[] = [
    { id: 'early', status: 'Killed' },
    ...Array.from({ length: 20 }, (_, index) => ({
        id: String(index),
        status: index % 3 === 2 ? 'Survived' : 'Killed',
    })),
];

// invariant: the reporter runs in a process of its own, as Stryker loads it: its stdout is a pipe, and a terminal is stood in for by the flag Stryker's own reporter reads.
function reported(terminal: boolean, tested: readonly Tested[]): string[] {
    const folder = mkdtempSync(join(tmpdir(), 'progress-reporter-'));
    onTestFinished(() => {
        rmSync(folder, { force: true, recursive: true });
    });
    const file = join(folder, 'progress-reporter.mjs');
    writeFileSync(file, PROGRESS_REPORTER_SOURCE);
    const program = `
const { strykerPlugins } = await import(${JSON.stringify(pathToFileURL(file).href)});
process.stdout.isTTY = ${JSON.stringify(terminal)};
const [plugin] = strykerPlugins;
process.stdout.write(\`\${plugin.kind} \${plugin.name} \${plugin.injectableClass.inject.length}\\n\`);
const reporter = new plugin.injectableClass();
reporter.onDryRunCompleted();
reporter.onMutationTestingPlanReady({ mutantPlans: ${JSON.stringify(PLANNED)} });
for (const result of ${JSON.stringify(tested)}) reporter.onMutantTested(result);
`;
    const run = spawnSync(process.execPath, ['--input-type=module', '--eval', program], {
        encoding: 'utf8',
    });

    return run.stdout
        .split('\n')
        .filter((line) => line !== '')
        .map((line) => line.replaceAll(/\d+\.\ds/gu, '<s>'));
}

describe('progress-reporter', () => {
    test('off a terminal, one line per tenth of the mutants the plan runs, and the dry run its seconds', () => {
        // Given - a plan of twenty mutants to run and one already judged, every third surviving
        const lines = reported(false, EVERY_THIRD_SURVIVES);

        // Then - the reporter Stryker loads by the config's name, the dry run, then ten steps, each naming what ran and what survives so far
        expect(lines).toStrictEqual([
            `Reporter ${PROGRESS_REPORTER} 0`,
            'dry run: <s>, the initial run of the tests over the unmutated sandbox',
            'progress: 10%, 2 of 20 mutants run, 0 surviving so far, no verdict yet (<s>)',
            'progress: 20%, 4 of 20 mutants run, 1 surviving so far, no verdict yet (<s>)',
            'progress: 30%, 6 of 20 mutants run, 2 surviving so far, no verdict yet (<s>)',
            'progress: 40%, 8 of 20 mutants run, 2 surviving so far, no verdict yet (<s>)',
            'progress: 50%, 10 of 20 mutants run, 3 surviving so far, no verdict yet (<s>)',
            'progress: 60%, 12 of 20 mutants run, 4 surviving so far, no verdict yet (<s>)',
            'progress: 70%, 14 of 20 mutants run, 4 surviving so far, no verdict yet (<s>)',
            'progress: 80%, 16 of 20 mutants run, 5 surviving so far, no verdict yet (<s>)',
            'progress: 90%, 18 of 20 mutants run, 6 surviving so far, no verdict yet (<s>)',
            'progress: 100%, 20 of 20 mutants run, 6 surviving so far, no verdict yet (<s>)',
        ]);
    });

    test("on a terminal, the dry run alone: Stryker's bar draws the progress", () => {
        // Given - the same plan, run on a terminal
        const lines = reported(true, EVERY_THIRD_SURVIVES);

        // Then - the dry run's line, and no step
        expect(lines.slice(1)).toStrictEqual([
            'dry run: <s>, the initial run of the tests over the unmutated sandbox',
        ]);
    });
});
