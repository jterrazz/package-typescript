import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from 'vitest';

import {
    catalog,
    FIXER_MARKERS,
    MARKERS,
    render,
    renderFixers,
    renderReference,
} from './catalog.js';

/*
 * The catalogue has two readers and one source. `docs/07-lint-presets.md` is
 * the human's, with the reason and the version behind every decision; the
 * skill reference is an agent's, trimmed to what it needs to answer "may I
 * write this". Both carry a table between two markers, both are PROJECTIONS of
 * `rules/`, and this suite fails either one that has drifted. Regenerate with
 * `TEST_UPDATE=1 npm test`, the gesture every other golden here takes.
 *
 * It is the @jterrazz/test pattern — one manifest, every roster derived from
 * it, freshness meta-tested — so a decision is never recorded in two places
 * that can disagree.
 */

const PROJECTIONS = {
    chapter: {
        markers: MARKERS,
        page: resolve(import.meta.dirname, '../docs/07-lint-presets.md'),
        render,
    },
    'fixer list': {
        markers: FIXER_MARKERS,
        page: resolve(import.meta.dirname, '../docs/07-lint-presets.md'),
        render: renderFixers,
    },
    'skill reference': {
        markers: MARKERS,
        page: resolve(import.meta.dirname, '../skills/jterrazz-typescript/references/rules.md'),
        render: renderReference,
    },
};

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

test('the skill reference routes the vitest scope instead of restating it', () => {
    // Given - the projection an agent reads
    const reference = renderReference();

    // Then - the vitest block names its owner, and no row spells a glob out
    expect(reference).toContain("@jterrazz/test's catalogue owns the shapes");
    expect(reference).not.toContain('__tests__');
    expect(reference).not.toContain('{test,spec,test-d,spec-d}');
});

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

        /*
         * The comparison is column-insensitive on purpose: oxfmt owns markdown
         * and it aligns a table's pipes. What a projection must carry is the
         * DECISIONS.
         */
        const fresh = readFileSync(page, 'utf8');
        const carried = fresh.slice(
            fresh.indexOf(markers.start) + markers.start.length,
            fresh.indexOf(markers.end),
        );
        expect(cells(carried)).toStrictEqual(cells(table));
    },
);
