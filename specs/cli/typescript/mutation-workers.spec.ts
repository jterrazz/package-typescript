import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { cli } from '../packed-cli.specification.js';

const recordOf = (value: unknown): Record<string, unknown> =>
    typeof value === 'object' && value !== null ? Object.fromEntries(Object.entries(value)) : {};

const listOf = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

type ReportedMutant = { coveredBy: string[]; status: string; testsCompleted: number };

function reportedMutants(content: string): Record<string, ReportedMutant> {
    const report = recordOf(JSON.parse(content));
    const names = new Map(
        Object.values(recordOf(report.testFiles)).flatMap((file) =>
            listOf(recordOf(file).tests).map((entry) => {
                const { id, name } = recordOf(entry);

                return [String(id), String(name)] as const;
            }),
        ),
    );

    return Object.fromEntries(
        Object.entries(recordOf(report.files)).flatMap(([file, entry]) =>
            listOf(recordOf(entry).mutants).map((value) => {
                const mutant = recordOf(value);
                const { column, line } = recordOf(recordOf(mutant.location).start);

                return [
                    `${file}:${String(line)}:${String(column)} ${String(mutant.mutatorName)} ${String(mutant.replacement)}`,
                    {
                        coveredBy: listOf(mutant.coveredBy)
                            .map((id) => names.get(String(id)) ?? String(id))
                            .toSorted(),
                        status: String(mutant.status),
                        testsCompleted: Number(mutant.testsCompleted ?? 0),
                    },
                ] as const;
            }),
        ),
    );
}

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
            .env({ TYPESCRIPT_JOBS: '1' })
            .exec('typescript mutation --mutate src/cli.ts');
        const three = await cli
            .fixture(directory('./__fixtures__/mutation-commands/'))
            .env({ TYPESCRIPT_JOBS: '3' })
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
    });
});
