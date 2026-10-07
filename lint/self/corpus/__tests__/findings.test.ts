import { describe, expect, test } from 'vitest';

import { FAMILIES, FINDINGS, printedFindingIds } from '../findings.js';

describe('findings', () => {
    test('printedFindingIds — findings — the catalogue holds every id a pass or a rule prints, and no other', () => {
        // Given - every finding id written in a pass, and every rule the plugin registers
        const printed = printedFindingIds();
        expect(printed.length).toBeGreaterThan(50);

        // Then - each has its row, and each row is still printed somewhere
        expect(FINDINGS.map((row) => row.id).toSorted()).toStrictEqual(printed);
    });

    test('printedFindingIds — findings — every row states its family and the one sentence it holds a project to', () => {
        // Given - every row of the findings catalogue
        expect(FINDINGS.length).toBeGreaterThan(50);

        // Then - its family is a word of the closed list, and its sentence is one sentence
        expect(
            FINDINGS.flatMap((row) =>
                [
                    FAMILIES.includes(row.family) ? null : `${row.id} has an unknown family`,
                    /^[A-Z`].*\.$/u.test(row.sentence) ? null : `${row.id} states no sentence`,
                ].filter((broken) => broken !== null),
            ),
        ).toStrictEqual([]);
    });
});
