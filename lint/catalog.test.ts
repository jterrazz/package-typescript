import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from 'vitest';

import { catalog, unsafeFixers } from './catalog.js';

/*
 * The catalogue-projection rule: the chapter's projection of the catalogue is
 * this package's own discipline — a `self` rule — so its renderer lives here,
 * beside the check, and ships nowhere. The catalogue has one reader and one source: `docs/07-lint-presets.md`
 * carries the reason and the version behind every decision, and the list of
 * fixers `fix` refuses. Both are tables between two markers, both are
 * PROJECTIONS of `lint/`, and this suite fails either one that has drifted.
 * Regenerate with `TEST_UPDATE=1 npm test`, the gesture every other golden
 * here takes.
 *
 * It is the @jterrazz/test pattern — one manifest, every roster derived from
 * it, freshness meta-tested — so a decision is never recorded in two places
 * that can disagree.
 */

/** One catalogue entry, as the chapter renders it. */
type Entry = ReturnType<typeof catalog>[number];

/** The fence that bounds the generated section of the chapter. */
const MARKERS = { end: '<!-- /GENERATED -->', start: '<!-- GENERATED -->' };

/** The fence that bounds the list of fixers `fix` refuses to run. */
const FIXER_MARKERS = { end: '<!-- /GENERATED:fixers -->', start: '<!-- GENERATED:fixers -->' };

/** What an `on` entry has to say for itself: where it applies, when that is not everywhere. */
function scopeOf(entry: Entry): string {
    if (entry.scoped === undefined) {
        return entry.typeAware === true ? 'type-aware' : '—';
    }
    return `scoped to ${entry.scoped.map((glob) => `\`${glob}\``).join(', ')}`;
}

/** One entry as a row of the chapter's table. */
function rowOf(entry: Entry): string {
    const state = entry.level === 'off' ? 'off' : 'on';
    const why =
        entry.level === 'off' && entry.reason !== undefined
            ? `${entry.reason.kind} — ${entry.reason.by}`
            : scopeOf(entry);

    return `| \`${entry.rule}\` | ${entry.profiles.join(', ')} | ${state} | ${why} | ${entry.since} |`;
}

/** The catalogue as the markdown table the chapter carries between its markers: its consumer rules alone. */
function render(): string {
    return [
        '| Rule | Profiles | State | Reason | Since |',
        '| --- | --- | --- | --- | --- |',
        ...catalog()
            .filter((entry) => entry.audience === 'consumer')
            .map((entry) => rowOf(entry)),
    ].join('\n');
}

/** The unsafe fixers as the markdown the chapter carries between its fixer markers. */
function renderFixers(): string {
    return unsafeFixers()
        .map(({ rule, why }) => `- \`${rule}\` — ${why}`)
        .join('\n');
}

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
