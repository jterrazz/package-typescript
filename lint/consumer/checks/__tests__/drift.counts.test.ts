import { describe, expect, test } from 'vitest';

import { driftLines, sum } from '../drift.counts.js';
import type { DriftCounts } from '../drift.counts.js';

const NOTHING: DriftCounts = {
    behind: [],
    declaration: null,
    exceptions: 0,
    held: [['typescript', 'nothing held']],
    ledger: 'nothing held',
    members: {},
    mutants: 0,
    off: [],
    optOuts: [],
    suppressions: 0,
    unmeasured: { members: {}, root: 0 },
};

describe('drift.counts', () => {
    test('driftLines — a project holding nothing reads one row per count, aligned on the baseline’s label', () => {
        // Given - a project with no declaration, no exception, no rule off and nothing held
        // Then - every row says so
        expect(driftLines(NOTHING)).toStrictEqual([
            '  declared                              nothing: node, the default',
            '  exceptions                            0',
            '  rules off vs profile                  none',
            '  suppressions                          0',
            '  .jterrazz/oxlint-suppressions.json    nothing held',
            '  .jterrazz/baseline.json › typescript  nothing held',
            '  tool versions                         in range',
        ]);
    });

    test('driftLines — every count a project holds, members, mutation directives, browser-side mutants and tools behind included', () => {
        // Given - a declared library whose members hold exceptions and unmeasured mutants, with rules off, laws set aside, suppressions, directives, a ledger, two baseline sections and two tools out of range
        const counts: DriftCounts = {
            behind: [
                { installed: '1.0.0', name: 'oxlint', range: '^1.2.0', verdict: 'old' },
                { installed: null, name: 'knip', range: '^6.0.0', verdict: 'absent' },
            ],
            declaration: { kind: 'library', platform: 'node' },
            exceptions: 3,
            held: [
                ['typescript', 7],
                ['other-tool', 'unreadable'],
            ],
            ledger: 5,
            members: { 'apps/a': 2, 'apps/b': 0 },
            mutants: 2,
            off: ['eqeqeq', 'no-console'],
            optOuts: [
                { law: 'names', reason: 'a reason' },
                { law: 'comments', reason: 'another' },
            ],
            suppressions: 4,
            unmeasured: { members: { 'apps/a': 1, 'apps/b': 0 }, root: 2 },
        };

        // Then - the totals over root and members, each member holding any on a row of its own, and every list named
        expect(driftLines(counts)).toStrictEqual([
            '  declared                              library on node',
            '  exceptions                            5',
            '    apps/a                              2 exceptions',
            '  rules off vs profile                  2 (eqeqeq, no-console)',
            '  laws set aside                        2 (names, comments)',
            '  suppressions                          4 + 2 mutation directives',
            '  unmeasured                            3 mutants (browser-side)',
            '    apps/a                              1 unmeasured mutants',
            '  .jterrazz/oxlint-suppressions.json    5',
            '  .jterrazz/baseline.json › typescript  7',
            '  .jterrazz/baseline.json › other-tool  unreadable',
            '  tool versions                         oxlint 1.0.0 old, knip absent',
        ]);
    });

    test('driftLines — a monorepo root declares nothing of its own, and a long label widens every row', () => {
        // Given - a root whose member holds no exception but unmeasured mutants, and a baseline section with a long name
        const counts: DriftCounts = {
            ...NOTHING,
            held: [
                ['typescript', 0],
                ['a-long-section-name', 1],
            ],
            members: { 'apps/a': 0 },
            unmeasured: { members: { 'apps/a': 3 }, root: 0 },
        };

        // Then - the monorepo's declaration, the member's mutants alone, and the rows aligned on the longest label
        expect(driftLines(counts)).toStrictEqual([
            '  declared                                       nothing: a monorepo, each member its own',
            '  exceptions                                     0',
            '  rules off vs profile                           none',
            '  suppressions                                   0',
            '  unmeasured                                     3 mutants (browser-side)',
            '    apps/a                                       3 unmeasured mutants',
            '  .jterrazz/oxlint-suppressions.json             nothing held',
            '  .jterrazz/baseline.json › typescript           0',
            '  .jterrazz/baseline.json › a-long-section-name  1',
            '  tool versions                                  in range',
        ]);
    });

    test('driftLines — the rows keep the baseline label’s width though no section is held', () => {
        // Given - a project whose baseline holds no section at all
        // Then - the values still open where the baseline's label would end
        expect(driftLines({ ...NOTHING, held: [] }).at(-1)).toBe(
            '  tool versions                         in range',
        );
    });

    test('sum — every count a record holds, and nothing for an empty one', () => {
        // Given - a record of counts, and an empty one
        // Then - their totals
        expect([sum({ a: 2, b: 3 }), sum({})]).toStrictEqual([5, 0]);
    });
});
