import type { Entry } from './decisions.js';
import { markdownTable } from './table.js';

function scopeOf(entry: Entry): string {
    if (entry.scoped === undefined) {
        return entry.typeAware === true ? 'type-aware' : '';
    }

    return `scoped to ${entry.scoped.map((glob) => `\`${glob}\``).join(', ')}`;
}

function cellsOf(entry: Entry): string[] {
    const state = entry.level === 'off' ? 'off' : 'on';
    const why =
        entry.level === 'off' && entry.reason !== undefined
            ? `${entry.reason.kind}, per ${entry.reason.by}`
            : scopeOf(entry);

    return [`\`${entry.rule}\``, entry.profiles.join(', '), state, why, entry.since];
}

export function renderDecisions(entries: readonly Entry[]): string {
    return markdownTable(
        ['Rule', 'Profiles', 'State', 'Reason', 'Since'],
        entries.map((entry) => cellsOf(entry)),
    );
}

export function renderFixers(fixers: readonly { rule: string; why: string }[]): string {
    const lines: string[] = [];
    for (const { rule, why } of fixers) {
        lines.push(`- \`${rule}\`: ${why}`);
    }

    return lines.join('\n');
}

export function renderFindings(rows: readonly { id: string; sentence: string }[]): string {
    return markdownTable(
        ['Rule', 'Requirement'],
        rows.map((row) => [`\`${row.id}\``, row.sentence]),
    );
}

export function renderSelfRows(
    rows: readonly { channel: string; home: string; id: string; why: string }[],
): string {
    return markdownTable(
        ['Id', 'Channel', 'Home', 'Why it stays self'],
        rows.map((row) => [`\`${row.id}\``, `\`${row.channel}\``, `\`${row.home}\``, row.why]),
    );
}
