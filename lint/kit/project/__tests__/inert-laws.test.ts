import { describe, expect, test } from 'vitest';

import { isInert, pathsOf } from '../inert-laws.js';
import type { ArchitectureRule } from '../preset.js';

const side = (path?: string | string[]): { path?: string | string[] } =>
    path === undefined ? {} : { path };

const rule = (from?: string | string[], to?: string | string[]): ArchitectureRule => ({
    fix: 'f',
    from: side(from),
    name: 'n',
    read: 'docs/reference/quality-checks.md#x',
    to: side(to),
    why: 'w',
});

const holds =
    (...folders: string[]) =>
    (folder: string): boolean =>
        folders.includes(folder);

describe('isInert', () => {
    test('isInert — a rule is inert when every path of one side opens on a folder the project does not hold', () => {
        // Given - a project holding src/, and rules over lint/
        const held = holds('src');

        // Then - a side of absent folders is inert, from or to, one string or a list
        expect([
            isInert(rule('^lint/kit', '^src/'), held),
            isInert(rule('^src/', '^lint/kit/'), held),
            isInert(rule(['^lint/kit/', '^lib/'], '^src/'), held),
        ]).toStrictEqual([true, true, true]);
    });

    test('isInert — a rule stays live when any folder of a side is held, when a path opens on no folder, or when a side names no path', () => {
        // Given - a project holding src/
        const held = holds('src');

        // Then - one held folder in a list, a pattern with no leading folder, a caret in the middle, and an absent path each keep the rule live
        expect([
            isInert(rule(['^lint/kit/', '^src/a/'], '^src/'), held),
            isInert(rule(['^lint/kit/', 'plain'], '^src/'), held),
            isInert(rule('foo^lint/', '^src/'), held),
            isInert(rule(undefined, '^src/'), held),
            isInert(rule([], '^src/'), held),
        ]).toStrictEqual([false, false, false, false, false]);
    });

    test('pathsOf — a string is its one path, a list is its strings alone, anything else has none', () => {
        // Given - a string, a list mixing strings with other values, a number and nothing
        // Then - the strings, in order
        expect([
            pathsOf('^src/'),
            pathsOf(['^lint/', 7, '^lib/', null]),
            pathsOf(42),
            pathsOf(undefined),
        ]).toStrictEqual([['^src/'], ['^lint/', '^lib/'], [], []]);
    });
});
