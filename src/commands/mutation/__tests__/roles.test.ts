import { describe, expect, test } from 'vitest';

import { byRole } from '../roles.js';

const survivor = (file: string, line: number) => ({
    column: 9,
    file,
    line,
    mutator: 'ConditionalExpression',
    replacement: 'false',
    report: '.artifacts/stryker/report.json',
});

const GLUE = { bar: 0.9, cap: 50, globs: ['**/infrastructure/**', 'src/legacy.ts'] };

describe('roles', () => {
    test('byRole — a source is glue where a glob names it and domain everywhere else; glue holds while the share of its mutants detected reaches the bar', () => {
        // Given - a domain survivor, and glue whose detected share sits exactly on the bar, then one under it
        const onTheBar = {
            detectedByFile: {
                'src/domain/price.ts': 5,
                'src/infrastructure/store.ts': 6,
                'src/legacy.ts': 3,
            },
            survivors: [
                survivor('src/domain/price.ts', 2),
                survivor('src/infrastructure/store.ts', 4),
            ],
        };
        const underIt = {
            ...onTheBar,
            survivors: [...onTheBar.survivors, survivor('src/legacy.ts', 7)],
        };

        // Then - the domain survivor is domain's; nine of ten glue mutants detected holds the bar, nine of eleven does not, and no glue mutant judged holds it
        expect([
            byRole(onTheBar, GLUE),
            byRole(underIt, GLUE).glue.holds,
            byRole({ detectedByFile: {}, survivors: [] }, GLUE).glue,
        ]).toStrictEqual([
            {
                domain: [survivor('src/domain/price.ts', 2)],
                glue: {
                    bar: 0.9,
                    detected: 9,
                    holds: true,
                    judged: 10,
                    survivors: [survivor('src/infrastructure/store.ts', 4)],
                },
            },
            false,
            { bar: 0.9, detected: 0, holds: true, judged: 0, survivors: [] },
        ]);
    });
});
