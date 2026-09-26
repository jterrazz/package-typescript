import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { decisions, unsafeFixers } from '../../catalogue/decisions.js';
import { rows } from './findings.js';

type Entry = ReturnType<typeof decisions>[number];

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
        ...decisions()
            .filter((entry) => entry.audience === 'consumer')
            .map((entry) => rowOf(entry)),
    ].join('\n');
}

function renderFixers(): string {
    return unsafeFixers()
        .map(({ rule, why }) => `- \`${rule}\` — ${why}`)
        .join('\n');
}

const QUALITY_CHECKS = resolve(import.meta.dirname, '../../../docs/06-quality-checks.md');

function renderFindings(family: string): string {
    return [
        '| Rule | Requirement |',
        '| --- | --- |',
        ...rows
            .filter((row) => row.family === family)
            .map((row) => `| \`${row.id}\` | ${row.sentence} |`),
    ].join('\n');
}

const TABLED_FAMILIES = [
    'docs',
    'publish',
    'drift',
    'suppressions',
    'markdown',
    'names',
    'tree',
    'comments',
    'secrets',
];

type SelfRow = { channel: string; home: string; id: string; why: string };

function isSelfRow(value: unknown): value is SelfRow {
    return typeof value === 'object' && value !== null && 'id' in value && 'home' in value;
}

function renderSelfRules(): string {
    const parsed: unknown = JSON.parse(
        readFileSync(resolve(import.meta.dirname, '../manifest.json'), 'utf8'),
    );
    return [
        '| Id | Channel | Home | Why it stays self |',
        '| --- | --- | --- | --- |',
        ...(Array.isArray(parsed) ? parsed : [])
            .filter((row) => isSelfRow(row))
            .map((row) => `| \`${row.id}\` | \`${row.channel}\` | \`${row.home}\` | ${row.why} |`),
    ].join('\n');
}

export const PROJECTIONS = {
    ...Object.fromEntries(
        TABLED_FAMILIES.map((family) => [
            `${family} table`,
            {
                markers: {
                    end: `<!-- /GENERATED:findings ${family} -->`,
                    start: `<!-- GENERATED:findings ${family} -->`,
                },
                page: QUALITY_CHECKS,
                render: () => renderFindings(family),
            },
        ]),
    ),
    chapter: {
        markers: MARKERS,
        page: resolve(import.meta.dirname, '../../../docs/07-lint-presets.md'),
        render: renderCatalogue,
    },
    'self rules': {
        markers: { end: '<!-- /GENERATED:self -->', start: '<!-- GENERATED:self -->' },
        page: resolve(import.meta.dirname, '../../../docs/03-testing.md'),
        render: renderSelfRules,
    },
    'fixer list': {
        markers: FIXER_MARKERS,
        page: resolve(import.meta.dirname, '../../../docs/07-lint-presets.md'),
        render: renderFixers,
    },
};

export function tableCells(table: string): string[] {
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
