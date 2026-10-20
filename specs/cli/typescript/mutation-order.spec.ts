import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { cli } from '../packed-cli.specification.js';
import { reportedMutants } from './__setup__/suite-report.js';

describe('mutation order', () => {
    test('typescript mutation — a mutant of what a command loads runs first the spec that ran its source, though the specs that only loaded it are quicker', async () => {
        // Given - a consumer whose three quick specs spawn its command and only load the label, and whose slow spec runs the command that reads it, measured at the label
        const result = await cli
            .fixture(directory('./__fixtures__/mutation-commands/'))
            .exec('typescript mutation --mutate src/labels.ts:1-1');

        // Then - the label's mutant is credited to every spec, and detected by the first one it runs, the slow one
        expect(result.exitCode).toBe(0);
        expect(
            reportedMutants(result.file('.artifacts/stryker/suite-report.json').content),
        ).toStrictEqual({
            'src/labels.ts:1:15 StringLiteral ""': {
                coveredBy: [
                    'an unknown command prints the usage and fails',
                    'a prints a',
                    'b prints its label, the slowest spec',
                    'no command prints the usage',
                ].toSorted(),
                status: 'Killed',
                testsCompleted: 1,
            },
        });
    });
});
