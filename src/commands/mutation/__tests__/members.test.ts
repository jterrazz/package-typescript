import { describe, expect, test } from 'vitest';

import { memberRuns, unownedRange } from '../members.js';

describe('members', () => {
    test("memberRuns — measures every member with the root's --since, and none when the root names none", () => {
        // Given - two members, measured since a commit, then against HEAD
        const since = memberRuns(['apps/api', 'apps/kit'], { ranges: undefined, since: 'main' });
        const head = memberRuns(['apps/api'], { ranges: undefined, since: undefined });

        // Then - each member runs, carrying the commit when one was named
        expect([since, head]).toStrictEqual([
            [
                { args: ['--since', 'main'], member: 'apps/api' },
                { args: ['--since', 'main'], member: 'apps/kit' },
            ],
            [{ args: [], member: 'apps/api' }],
        ]);
    });

    test('memberRuns — hands each member the ranges that sit in it, named from its folder, and skips a member none names', () => {
        // Given - three ranges in one member, one in a member whose name another extends
        const runs = memberRuns(['apps/api', 'apps/api-gateway', 'apps/kit'], {
            ranges: ['apps/api/src/a.ts:1-3', 'apps/api-gateway/src/b.ts', 'apps/api/src/c.ts:5-9'],
            since: 'main',
        });

        // Then - the ranges join in their member, a prefix never steals a sibling's, and the unnamed member is left out
        expect(runs).toStrictEqual([
            {
                args: ['--since', 'main', '--mutate', 'src/a.ts:1-3,src/c.ts:5-9'],
                member: 'apps/api',
            },
            { args: ['--since', 'main', '--mutate', 'src/b.ts'], member: 'apps/api-gateway' },
        ]);
    });

    test('unownedRange — names the first range no member holds, and none when each sits in one', () => {
        // Given - two members, a member named as a prefix of another's folder
        const members = ['apps/api', 'apps/kit'];

        // Then - a range in a member is owned; one beside them, or under a longer name, is not
        expect([
            unownedRange(members, ['apps/api/src/a.ts:1-2', 'apps/kit/lint/b.ts']),
            unownedRange(members, ['apps/api/src/a.ts', 'apps/apis/src/a.ts', 'src/c.ts']),
        ]).toStrictEqual([undefined, 'apps/apis/src/a.ts']);
    });
});
