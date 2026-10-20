import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

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
});
