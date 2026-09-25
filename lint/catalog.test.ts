import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { catalog, unsafeFixers } from './catalog.js';

// The chapter's generated tables are projections of `lint/`; `TEST_UPDATE=1 npm test` regenerates them.

type Entry = ReturnType<typeof catalog>[number];

const MARKERS = { end: '<!-- /GENERATED -->', start: '<!-- GENERATED -->' };

const FIXER_MARKERS = { end: '<!-- /GENERATED:fixers -->', start: '<!-- GENERATED:fixers -->' };

function scopeOf(entry: Entry): string {
    if (entry.scoped === undefined) {
        return entry.typeAware === true ? 'type-aware' : '—';
    }
    return `scoped to ${entry.scoped.map((glob) => `\`${glob}\``).join(', ')}`;
}

function rowOf(entry: Entry): string {
    const state = entry.level === 'off' ? 'off' : 'on';
    const why =
        entry.level === 'off' && entry.reason !== undefined
            ? `${entry.reason.kind} — ${entry.reason.by}`
            : scopeOf(entry);

    return `| \`${entry.rule}\` | ${entry.profiles.join(', ')} | ${state} | ${why} | ${entry.since} |`;
}

function renderCatalogue(): string {
    return [
        '| Rule | Profiles | State | Reason | Since |',
        '| --- | --- | --- | --- | --- |',
        ...catalog()
            .filter((entry) => entry.audience === 'consumer')
            .map((entry) => rowOf(entry)),
    ].join('\n');
}

function renderFixers(): string {
    return unsafeFixers()
        .map(({ rule, why }) => `- \`${rule}\` — ${why}`)
        .join('\n');
}

const PROJECTIONS = {
    chapter: {
        markers: MARKERS,
        page: resolve(import.meta.dirname, '../docs/07-lint-presets.md'),
        render: renderCatalogue,
    },
    'fixer list': {
        markers: FIXER_MARKERS,
        page: resolve(import.meta.dirname, '../docs/07-lint-presets.md'),
        render: renderFixers,
    },
};

function tableCells(table: string): string[] {
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

describe('catalog', () => {
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
