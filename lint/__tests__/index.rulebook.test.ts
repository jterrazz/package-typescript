import { describe, expect, test } from 'vitest';

import { PROFILE_CONFIGS } from '../index.rulebook.js';

describe('index.rulebook', () => {
    test.each(Object.entries(PROFILE_CONFIGS))(
        'the %s profile never lints the ground a spec stands on',
        (_name, profile) => {
            // Given - a profile a consumer names
            // Then - the four ground folders among the special folders @jterrazz/test reads are ignored wherever they sit
            expect(profile.ignorePatterns).toStrictEqual(
                expect.arrayContaining([
                    '**/__fixtures__/**',
                    '**/__expected__/**',
                    '**/__seeds__/**',
                    '**/__requests__/**',
                ]),
            );
        },
    );
});
