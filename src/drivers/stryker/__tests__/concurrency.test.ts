import { describe, expect, test } from 'vitest';

import { concurrencyOf, jobsNamed } from '../concurrency.js';

describe('concurrency', () => {
    test('jobsNamed — nothing unset or blank, a positive integer as written, anything else not a count', () => {
        // Given - the variable unset, blank, a count, a padded count, and five spellings of no count
        // Then - each spelling reads as the run reads it
        expect(
            [undefined, '', '  ', '4', ' 12 ', '0', '-2', '1.5', 'many'].map((value) =>
                jobsNamed(value),
            ),
        ).toStrictEqual([
            undefined,
            undefined,
            undefined,
            4,
            12,
            Number.NaN,
            Number.NaN,
            Number.NaN,
            Number.NaN,
        ]);
    });

    test('concurrencyOf — the count named wins for both stages; else each gate takes its share of the cores, the suite three quarters of it, never below one', () => {
        // Given - a count named, then none, on machines of ten, four and eight cores shared by one to nine gates
        // Then - named, alone on ten cores, three gates on ten, more gates than cores, and no gate counted
        expect([
            concurrencyOf('modules', { cores: 10, gates: 3, jobs: 2 }),
            concurrencyOf('suite', { cores: 10, gates: 3, jobs: 2 }),
            concurrencyOf('modules', { cores: 10, gates: 1, jobs: undefined }),
            concurrencyOf('suite', { cores: 10, gates: 1, jobs: undefined }),
            concurrencyOf('modules', { cores: 10, gates: 3, jobs: undefined }),
            concurrencyOf('suite', { cores: 10, gates: 3, jobs: undefined }),
            concurrencyOf('modules', { cores: 4, gates: 9, jobs: undefined }),
            concurrencyOf('suite', { cores: 4, gates: 9, jobs: undefined }),
            concurrencyOf('modules', { cores: 8, gates: 0, jobs: undefined }),
        ]).toStrictEqual([2, 2, 10, 7, 3, 2, 1, 1, 8]);
    });
});
