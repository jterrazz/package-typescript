import { describe, expect, test } from 'vitest';

import { groupsOf } from '../groups.js';

describe('groupsOf', () => {
    test('hands back each named group of a match as the string it captured', () => {
        // Given - a match of a pattern that always fills both its groups
        const match = /^(?<name>[^@]+)@(?<version>.+)$/u.exec('left-pad@1.3.0');

        // Then - both groups, with no undefined to default
        expect(groupsOf(match, ['name', 'version'])).toStrictEqual({
            name: 'left-pad',
            version: '1.3.0',
        });
    });

    test('keeps an empty capture, which is a group the pattern filled', () => {
        // Given - a group that captured nothing
        const match = /^(?<head>a*)b$/u.exec('b');

        // Then - the empty string, not a missing group
        expect(groupsOf(match, ['head'])).toStrictEqual({ head: '' });
    });

    test('throws, naming the group, on one the match does not hold', () => {
        // Given - a group an alternative skipped, and no match at all
        const skipped = /^(?:(?<one>a)|(?<two>b))$/u.exec('a');

        // Then - each says which group was asked for
        expect(() => groupsOf(skipped, ['two'])).toThrow('the match holds no group named two');
        expect(() => groupsOf(null, ['one'])).toThrow('the match holds no group named one');
    });
});
