import { describe, expect, test } from 'vitest';

import { projectOxlintOf } from '../project-oxlint.js';

describe('project-oxlint', () => {
    test('a rule set apart with no reason is refused, naming the rule and what it owes', () => {
        // Given - a rule turned off with a bare level
        const read = projectOxlintOf({ rules: { 'no-debugger': 'off' } });

        // Then - the settings are refused, and nothing is read from them
        expect(read).toStrictEqual({
            overrides: [],
            problem:
                'sets `no-debugger` with no `{ level, reason }`: a rule the project sets apart from its profile says why',
            reasons: {},
            rules: {},
        });
    });
});
