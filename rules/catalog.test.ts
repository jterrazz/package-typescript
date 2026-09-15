import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from 'vitest';

import { catalog, MARKERS, render } from './catalog.js';

/*
 * The catalogue chapter is a PROJECTION, not a page: `docs/07-lint-presets.md`
 * carries the table between two markers and this suite fails the chapter that
 * has drifted from the manifest. Regenerate it with `TEST_UPDATE=1 npm test`,
 * the same gesture every other golden of this repository takes.
 *
 * It is the @jterrazz/test pattern — one manifest, every roster derived from
 * it, freshness meta-tested — so a decision is never recorded in two places
 * that can disagree.
 */

const CHAPTER = resolve(import.meta.dirname, '../docs/07-lint-presets.md');

/** A markdown table as its cells, with the alignment padding taken out. */
function cells(table: string): string[] {
    return table
        .trim()
        .split('\n')
        .map((row) =>
            row
                .split('|')
                .map((cell) => cell.trim().replaceAll(/^-+$/gu, '---'))
                .join(' | '),
        );
}

test('every decision carries the version it was taken in', () => {
    // Given - the whole catalogue
    const entries = catalog();
    expect(entries.length).toBeGreaterThan(500);

    // Then - each one names a semver, which is what replaces a changelog here
    for (const entry of entries) {
        expect.soft(entry.since, `${entry.rule} has no since`).toMatch(/^\d+\.\d+\.\d+$/u);
    }
});

test('the chapter carries the catalogue the manifest renders', () => {
    // Given - the generated section of the rulebook chapter
    const chapter = readFileSync(CHAPTER, 'utf8');
    const start = chapter.indexOf(MARKERS.start);
    const end = chapter.indexOf(MARKERS.end);
    expect(start, 'the chapter has lost its GENERATED marker').toBeGreaterThan(-1);
    expect(end, 'the chapter has lost its /GENERATED marker').toBeGreaterThan(start);

    // Then - it is exactly what the manifest renders today
    const table = render();
    if (process.env.TEST_UPDATE === '1') {
        const head = chapter.slice(0, start + MARKERS.start.length);
        writeFileSync(CHAPTER, `${head}\n\n${table}\n\n${chapter.slice(end)}`);
    }

    // The comparison is column-insensitive on purpose: oxfmt owns markdown, and
    // It aligns a table's pipes. What the chapter must carry is the DECISIONS.
    const fresh = readFileSync(CHAPTER, 'utf8');
    const carried = fresh.slice(
        fresh.indexOf(MARKERS.start) + MARKERS.start.length,
        fresh.indexOf(MARKERS.end),
    );
    expect(cells(carried)).toStrictEqual(cells(table));
});
