import { afterEach, describe, expect, test, vi } from 'vitest';

import { askedOf, blankAsUnset } from '../asked.js';

afterEach(() => {
    vi.unstubAllEnvs();
});

describe('asked', () => {
    test('blankAsUnset — a blank value reads as unset, any other stands', () => {
        // Given - a value, an empty one, a blank one and none
        // Then - only the value stands
        expect([
            blankAsUnset('abc'),
            blankAsUnset(''),
            blankAsUnset('  \t'),
            blankAsUnset(undefined),
        ]).toStrictEqual(['abc', undefined, undefined, undefined]);
    });

    test('askedOf — reads the ranges as a list and the commit to measure since, the flag before the variable', () => {
        // Given - no variable, the commit and the ranges as flags, and a variable under a flag, outside CI
        vi.stubEnv('CI', '');
        vi.stubEnv('TYPESCRIPT_MUTATION_COLD', '');
        vi.stubEnv('TYPESCRIPT_MUTATION_SINCE', '');
        const flags = askedOf(['--mutate', 'a.ts:1-2,b.ts', '--since', 'main']);
        vi.stubEnv('TYPESCRIPT_MUTATION_SINCE', 'v1');
        const variable = askedOf([]);
        const both = askedOf(['--since', 'v2']);
        vi.stubEnv('TYPESCRIPT_MUTATION_SINCE', '  ');
        const blank = askedOf([]);

        // Then - the ranges split on commas, the flag beats the variable, a blank variable is unset
        expect([flags, variable, both, blank]).toStrictEqual([
            { cold: false, named: 'main', ranges: ['a.ts:1-2', 'b.ts'] },
            { cold: false, named: 'v1', ranges: undefined },
            { cold: false, named: 'v2', ranges: undefined },
            { cold: false, named: undefined, ranges: undefined },
        ]);
    });

    test('askedOf — a run is cold when the flag says so or the variable holds any text, and not when it is blank or absent, nor because CI is set', () => {
        // Given - each way a run is asked, outside CI first
        vi.stubEnv('CI', '');
        vi.stubEnv('TYPESCRIPT_MUTATION_COLD', '');
        const none = askedOf([]).cold;
        const flag = askedOf(['--cold']).cold;
        vi.stubEnv('TYPESCRIPT_MUTATION_COLD', '1');
        const variable = askedOf([]).cold;
        vi.stubEnv('TYPESCRIPT_MUTATION_COLD', '   ');
        const blank = askedOf([]).cold;
        vi.stubEnv('CI', 'true');
        const ci = askedOf([]).cold;
        vi.stubEnv('CI', ' ');
        const blankCi = askedOf([]).cold;

        // Then - cold by flag or by variable, never by a blank one nor by CI alone
        expect([none, flag, variable, blank, ci, blankCi]).toStrictEqual([
            false,
            true,
            true,
            false,
            false,
            false,
        ]);
    });
});
