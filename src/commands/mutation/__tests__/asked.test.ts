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
        vi.stubEnv('TYPESCRIPT_MUTATION_SINCE', '');
        const flags = askedOf(['--mutate', 'a.ts:1-2,b.ts', '--since', 'main']);
        vi.stubEnv('TYPESCRIPT_MUTATION_SINCE', 'v1');
        const variable = askedOf([]);
        const both = askedOf(['--since', 'v2']);
        vi.stubEnv('TYPESCRIPT_MUTATION_SINCE', '  ');
        const blank = askedOf([]);

        // Then - the ranges split on commas, the flag beats the variable, a blank variable is unset
        expect([flags, variable, both, blank]).toStrictEqual([
            { cold: false, named: 'main', ranges: ['a.ts:1-2', 'b.ts'], report: undefined },
            { cold: false, named: 'v1', ranges: undefined, report: undefined },
            { cold: false, named: 'v2', ranges: undefined, report: undefined },
            { cold: false, named: undefined, ranges: undefined, report: undefined },
        ]);
    });

    test('askedOf — a run is cold when the flag says so, and never because of the host it runs on', () => {
        // Given - a run asked nothing and one asked cold, outside CI, then a run asked nothing where CI is set
        vi.stubEnv('CI', '');
        const none = askedOf([]).cold;
        const flag = askedOf(['--cold']).cold;
        vi.stubEnv('CI', 'true');
        const ci = askedOf([]).cold;

        // Then - cold by the flag alone
        expect([none, flag, ci]).toStrictEqual([false, true, false]);
    });

    test('askedOf — reads the report a person asked for beside the JSON ones, and none unless asked', () => {
        // Given - a run asked nothing, and one asked for the HTML report
        // Then - the format is read as written
        expect([askedOf([]).report, askedOf(['--report', 'html']).report]).toStrictEqual([
            undefined,
            'html',
        ]);
    });
});
