import { markdownTable } from './table.js';

function scopeOf(entry) {
    if (entry.scoped === undefined) {
        return entry.typeAware === true ? 'type-aware' : '—';
    }

    return `scoped to ${entry.scoped.map((glob) => `\`${glob}\``).join(', ')}`;
}

function cellsOf(entry) {
    const state = entry.level === 'off' ? 'off' : 'on';
    const why =
        entry.level === 'off' && entry.reason !== undefined
            ? `${entry.reason.kind} — ${entry.reason.by}`
            : scopeOf(entry);

    return [`\`${entry.rule}\``, entry.profiles.join(', '), state, why, entry.since];
}

export function renderDecisions(entries) {
    return markdownTable(
        ['Rule', 'Profiles', 'State', 'Reason', 'Since'],
        entries.map((entry) => cellsOf(entry)),
    );
}

export function renderFixers(fixers) {
    const lines = [];
    for (const { rule, why } of fixers) {
        lines.push(`- \`${rule}\` — ${why}`);
    }

    return lines.join('\n');
}

export function renderFindings(rows) {
    return markdownTable(
        ['Rule', 'Requirement'],
        rows.map((row) => [`\`${row.id}\``, row.sentence]),
    );
}

export function renderSelfRows(rows) {
    return markdownTable(
        ['Id', 'Channel', 'Home', 'Why it stays self'],
        rows.map((row) => [`\`${row.id}\``, `\`${row.channel}\``, `\`${row.home}\``, row.why]),
    );
}
