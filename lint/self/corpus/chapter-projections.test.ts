import { readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

import { PROJECTIONS, tableCells } from './chapter-projections.js';

// The chapter's generated tables are projections of `lint/`; `TEST_UPDATE=1 npm test` regenerates them.

describe('chapter-projections', () => {
    test.each(Object.entries(PROJECTIONS))(
        'the %s carries the catalogue the manifest renders',
        (_name, { markers, page, render: project }) => {
            // Given - the generated section of the projection
            const before = readFileSync(page, 'utf8');
            const start = before.indexOf(markers.start);
            const end = before.indexOf(markers.end);
            expect(start, 'the page has lost its GENERATED marker').toBeGreaterThan(-1);
            expect(end, 'the page has lost its /GENERATED marker').toBeGreaterThan(start);

            // Then - it is exactly what the manifest renders today
            const table = project();
            if (process.env.TEST_UPDATE === '1') {
                const head = before.slice(0, start + markers.start.length);
                writeFileSync(page, `${head}\n\n${table}\n\n${before.slice(end)}`);
            }

            // Column-insensitive: oxfmt aligns a table's pipes, and a projection owes only the decisions.
            const fresh = readFileSync(page, 'utf8');
            const carried = fresh.slice(
                fresh.indexOf(markers.start) + markers.start.length,
                fresh.indexOf(markers.end),
            );
            expect(tableCells(carried)).toStrictEqual(tableCells(table));
        },
    );
});
