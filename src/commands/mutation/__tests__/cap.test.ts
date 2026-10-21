import { describe, expect, test } from 'vitest';

import type { Made } from '../../../drivers/stryker/enumerate.js';
import { capped, cappedEntries, cappedReport } from '../cap.js';
import { fileOfRange } from '../scope.js';

const madeAt = (file: string, line: number): Made => ({
    column: 5,
    endColumn: 12,
    endLine: line,
    file,
    line,
    mutator: 'EqualityOperator',
    replacement: 'a >= 1',
});

const reported = (at: number, mutatorName = 'EqualityOperator'): unknown => ({
    location: { end: { column: 12, line: at }, start: { column: 5, line: at } },
    mutatorName,
    replacement: 'a >= 1',
});

const SIXTY = Array.from({ length: 60 }, (_, at) => madeAt('src/infrastructure/rates.ts', at + 1));

describe('cap', () => {
    test('capped — a change within the cap is measured whole; past it, the same cap of mutants is kept whatever order they were made in', () => {
        // Given - sixty glue mutants, made in order and in reverse
        const forward = capped(SIXTY, 50);
        const backward = capped(SIXTY.toReversed(), 50);

        // Then - no cap at sixty or more, fifty kept of sixty past it, the same fifty both ways, a sample neither the first nor the last fifty
        expect(capped(SIXTY, 60)).toBeUndefined();
        expect([forward?.measured.length, forward?.of, [...(forward?.files ?? [])]]).toStrictEqual([
            50,
            60,
            ['src/infrastructure/rates.ts'],
        ]);
        expect(backward?.kept).toStrictEqual(forward?.kept);
        expect(
            forward?.measured.map(({ line }) => line).toSorted((one, other) => one - other),
        ).not.toStrictEqual(Array.from({ length: 50 }, (_, at) => at + 1));
    });

    test('capped — the sample is a function of each mutant alone: the mutants it keeps are named by place, mutator and replacement', () => {
        // Given - two mutants, then the same two besides a third
        const two = [madeAt('src/a.ts', 1), madeAt('src/a.ts', 2)];
        const three = [...two, madeAt('src/a.ts', 3)];

        // Then - one of two kept, and the order between them the same with the third present
        const kept = capped(two, 1)?.kept;
        const ofThree = capped(three, 2)?.measured.map(({ line }) => line);
        expect(kept?.size).toBe(1);
        expect(ofThree?.filter((line) => line !== 3).slice(0, 1)).toStrictEqual(
            [...(kept ?? [])].map((key) => Number(key.split(':')[1])),
        );
    });

    test('cappedEntries — a capped file gives way to a range per kept mutant, columns from 0; every other entry stands', () => {
        // Given - the cap keeping one of two mutants of a glue file, and entries naming it and a domain file
        const cap = capped(
            [madeAt('src/infrastructure/a.ts', 3), madeAt('src/infrastructure/a.ts', 4)],
            1,
        );
        const kept = cap?.measured[0]?.line;

        // Then - the domain entry stands, the glue file's lines give way to the kept mutant's node
        expect(
            cap === undefined
                ? []
                : cappedEntries(
                      ['src/domain/b.ts:1-9', 'src/infrastructure/a.ts:3-4'],
                      cap,
                      fileOfRange,
                  ),
        ).toStrictEqual([
            'src/domain/b.ts:1-9',
            `src/infrastructure/a.ts:${String(kept)}:4-${String(kept)}:11`,
        ]);
        expect(
            cap === undefined ? [] : cappedEntries(['src/domain/b.ts:1-9'], cap, fileOfRange),
        ).toStrictEqual(['src/domain/b.ts:1-9']);
    });

    test('cappedReport — a capped file keeps only the mutants the cap kept, none where it lists none; every other file is left whole', () => {
        // Given - the cap keeping two of three mutants over two glue files, and a report holding them, a mutant nested in a kept node, a capped file listing no mutant and a domain file
        const cap = capped(
            [
                madeAt('src/infrastructure/a.ts', 3),
                madeAt('src/infrastructure/a.ts', 4),
                madeAt('src/infrastructure/a.ts', 5),
            ],
            2,
        );
        const keptLines = (cap?.measured ?? [])
            .map(({ line }) => line)
            .toSorted((one, other) => one - other);
        const capOver =
            cap === undefined
                ? undefined
                : { ...cap, files: new Set([...cap.files, 'src/infrastructure/c.ts']) };
        const report = {
            files: {
                'src/domain/b.ts': { mutants: [reported(1)] },
                'src/infrastructure/a.ts': {
                    language: 'typescript',
                    mutants: [
                        reported(3),
                        reported(4),
                        reported(5),
                        reported(3, 'ConditionalExpression'),
                    ],
                },
                'src/infrastructure/c.ts': { language: 'typescript' },
            },
            schemaVersion: '2',
        };

        // Then - the kept mutants alone in the glue file, none in the one listing none, the domain file whole
        expect(capOver === undefined ? undefined : cappedReport(report, capOver)).toStrictEqual({
            files: {
                'src/domain/b.ts': { mutants: [reported(1)] },
                'src/infrastructure/a.ts': {
                    language: 'typescript',
                    mutants: keptLines.map((line) => reported(line)),
                },
                'src/infrastructure/c.ts': { language: 'typescript', mutants: [] },
            },
            schemaVersion: '2',
        });
        expect(keptLines).toHaveLength(2);
    });
});
