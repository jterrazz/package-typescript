import { directory } from '@jterrazz/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { temporaryDirectory } from '../../__setup__/temporary-directory.js';
import { cli } from '../packed-cli.specification.js';
import { reportedMutants } from './__setup__/suite-report.js';
import type { ReportedMutant } from './__setup__/suite-report.js';

const coverage = (content: string): Record<string, Pick<ReportedMutant, 'coveredBy' | 'status'>> =>
    Object.fromEntries(
        Object.entries(reportedMutants(content)).map(([mutant, { coveredBy, status }]) => [
            mutant,
            { coveredBy, status },
        ]),
    );

// invariant: a line of the fixture's log is a test file's kind, the mutant live in its process (`undefined` in the dry run) and that process's pid; the count is the most processes one run of a kind took.
function processesByRun(log: string): Record<string, number> {
    const runs = new Map<string, { kind: string; pids: Set<string> }>();
    for (const line of readFileSync(log, 'utf8').trim().split('\n')) {
        const [kind, mutant, pid] = line.split(' ');
        const phase = `${String(kind)} ${mutant === 'undefined' ? 'dry run' : 'mutant'}`;
        const run = runs.get(`${phase} ${String(mutant)}`) ?? {
            kind: phase,
            pids: new Set<string>(),
        };
        runs.set(`${phase} ${String(mutant)}`, { ...run, pids: run.pids.add(String(pid)) });
    }
    const counts: Record<string, number> = {};
    for (const { kind, pids } of runs.values()) {
        counts[kind] = Math.max(counts[kind] ?? 0, pids.size);
    }

    return counts;
}

describe('mutation workers', () => {
    test('typescript mutation — the suite’s dry run runs on every test runner the stage has, and credits each mutant to the tests it credits on one', async () => {
        // Given - a consumer whose four specs each spawn its command, measured whole on one test runner, then on three
        const one = await cli
            .fixture(directory('./__fixtures__/mutation-commands/'))
            .env({ TYPESCRIPT_CAPACITY: 'cpus=1,memory=64g' })
            .exec('typescript mutation --mutate src/cli.ts');
        const three = await cli
            .fixture(directory('./__fixtures__/mutation-commands/'))
            .env({ TYPESCRIPT_CAPACITY: 'cpus=3,memory=64g' })
            .exec('typescript mutation --mutate src/cli.ts');

        // Then - each says how many workers its dry run ran on, and both reports credit and judge every mutant alike
        expect(
            [one.stdout.text, three.stdout.text].map((text) => /dry run: .*\n/u.exec(text)?.[0]),
        ).toStrictEqual([
            'dry run: every test file, on 1 worker(s)\n',
            'dry run: every test file, on 3 worker(s)\n',
        ]);
        const measured = coverage(one.file('.artifacts/stryker/suite-report.json').content);
        expect(Object.keys(measured).length).toBeGreaterThan(5);
        expect(coverage(three.file('.artifacts/stryker/suite-report.json').content)).toStrictEqual(
            measured,
        );
        // Then - the stage learned what one of its test runners holds
        const prices: unknown = JSON.parse(three.file('.artifacts/capacity.json').content);
        expect(prices).toHaveProperty(['stryker-suite', 0]);
    });

    test('typescript mutation — a mutant only the processes a spec spawns ran keeps the worker its project keeps, and one a spec ran in its own process gives each file its own', async () => {
        // Given - a consumer whose project keeps its worker, two of its specs spawning the command that prints the label, two adding in their own process; every mutant lives, so each runs every file that covers it
        const log = join(temporaryDirectory('mutation-worker-'), 'processes.log');
        await cli
            .fixture(directory('./__fixtures__/mutation-worker/'))
            .env({ TYPESCRIPT_CAPACITY: 'cpus=1,memory=64g', WORKER_LOG: log })
            .exec('typescript mutation --mutate src/label.ts:1-1,src/sum.ts:1-1');

        // Then - the dry run gives each file a process of its own, a label mutant runs both spawning specs in one, a sum mutant each adding spec in its own
        expect(processesByRun(log)).toStrictEqual({
            'adds dry run': 2,
            'adds mutant': 2,
            'spec dry run': 2,
            'spec mutant': 1,
        });
    });
});
