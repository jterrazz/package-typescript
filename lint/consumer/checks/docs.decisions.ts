import type { DocsTree } from '../../kit/project/docs-tree.js';

export const DOCS_RULES = [
    'docs/brief-routes-to-the-map',
    'docs/decision-heading-carries-its-number',
    'docs/decision-listed-in-the-map',
    'docs/decision-named-by-number-and-subject',
    'docs/decision-number-unique',
    'docs/decision-status-known',
    'docs/decision-template-present',
    'docs/decisions-numbered-contiguously',
    'docs/manual-present',
    'docs/map-links-only-pages',
    'docs/map-matches-pages',
    'docs/map-present',
    'docs/no-agents-brief',
    'docs/no-cross-repository-link',
    'docs/no-loose-file',
    'docs/no-unknown-subfolder',
    'docs/page-named-in-kebab-case',
    'docs/page-names-a-subject',
    'docs/release-guide-present-when-shipping',
    'docs/required-pages-present',
    'docs/section-is-flat',
] as const;

/** A rule of the Docs (layout) pass, by its id: a rename breaks the build of a consumer comparing one. */
export type DocsRule = (typeof DOCS_RULES)[number];

export type Report = (rule: DocsRule, path: string, message: string) => void;

type Entry = { name: string; path: string };

function filesUnder(files: readonly string[], folder: string): Entry[] {
    const prefix = `docs/${folder}`;

    return files
        .filter((path) => path.startsWith(prefix) && !path.endsWith('/'))
        .map((path) => ({ name: path.slice(prefix.length), path }));
}

const STATUSES: ReadonlySet<string> = new Set(['Proposed', 'Accepted', 'Deprecated']);

const SUPERSEDED = /^Superseded by \[ADR-\d{3}\]\([^)]+\)$/u;

const BARE_SUPERSEDED = /^Superseded by ADR-\d{3}$/u;

const DECISION_NAME = /^\d{3}-[a-z\d]+(?:-[a-z\d]+)*\.md$/u;

const DECISION_HEADING = /^# ADR-(?<number>\d{3}): \S/u;

const DECISION_STATUS = /^\*\*Status:\*\*\s*(?<status>.+?)\s*$/u;

function auditDecisionNumbers(report: Report, records: readonly Entry[]): void {
    const numbers = [...new Set(records.map((record) => record.name.slice(0, 3)))].toSorted();
    const sequential = numbers.every((number, index) => Number.parseInt(number, 10) === index + 1);
    if (!sequential) {
        report(
            'docs/decisions-numbered-contiguously',
            'docs/decisions/',
            `docs/decisions/ numbers run ${numbers.join(', ')}: they run from 001 with no gap, and a decision that moved folders takes the next number where it lands`,
        );
    }

    const claimed = new Map<string, string>();
    for (const record of records) {
        const number = record.name.slice(0, 3);
        const first = claimed.get(number);

        if (first === undefined) {
            claimed.set(number, record.name);
        } else {
            report(
                'docs/decision-number-unique',
                'docs/decisions/',
                `ADR-${number} is claimed by ${first} and ${record.name}`,
            );
        }
    }
}

function statusOf(line: string): string | undefined {
    // Stryker disable next-line OptionalChaining: a match of a pattern holding a named group always carries its groups
    return DECISION_STATUS.exec(line)?.groups?.status;
}

function auditRecord(report: Report, record: Entry, heads: DocsTree['heads']): void {
    const number = record.name.slice(0, 3);
    const head = heads[record.path] ?? [];
    const opening = head[0] ?? '';

    // Stryker disable next-line OptionalChaining: a match of a pattern holding a named group always carries its groups
    if (DECISION_HEADING.exec(opening)?.groups?.number !== number) {
        report(
            'docs/decision-heading-carries-its-number',
            record.path,
            `${record.path} opens on ${opening === '' ? 'an empty line' : opening}: the mold is "# ADR-${number}: Title"`,
        );
    }

    const status = head.map((line) => statusOf(line)).find((found) => found !== undefined);
    if (status === undefined) {
        report(
            'docs/decision-status-known',
            record.path,
            `${record.path} carries no **Status:** line; the mold is "**Status:** Proposed"`,
        );
    } else if (!(STATUSES.has(status) || SUPERSEDED.test(status))) {
        const message = BARE_SUPERSEDED.test(status)
            ? `${record.path}: **Status:** names a successor but no link; write Superseded by [ADR-NNN](file.md)`
            : `${record.path}: **Status:** is none of Proposed, Accepted, Superseded by [ADR-NNN](file.md), Deprecated`;
        report('docs/decision-status-known', record.path, message);
    }
}

export function auditDecisions(
    report: Report,
    { files, heads }: { files: readonly string[]; heads: DocsTree['heads'] },
): void {
    if (!files.includes('docs/decisions/')) {
        return;
    }

    const entries = filesUnder(files, 'decisions/');

    for (const entry of entries) {
        const mold = entry.name === '_template.md' || entry.name === 'README.md';
        if (!mold && !DECISION_NAME.test(entry.name)) {
            report(
                'docs/decision-named-by-number-and-subject',
                entry.path,
                `${entry.path} is not NNN-kebab.md`,
            );
        }
    }

    const records = entries.filter((entry) => /^\d{3}-/u.test(entry.name));
    for (const record of records) {
        auditRecord(report, record, heads);
    }

    auditDecisionNumbers(report, records);

    if (files.includes('docs/decisions/README.md')) {
        report(
            'docs/decision-listed-in-the-map',
            'docs/decisions/README.md',
            'docs/decisions/README.md is an index, and an index is a copy; the queue is derived (terra <brand> decisions)',
        );
    }

    if (!files.includes('docs/decisions/_template.md')) {
        report(
            'docs/decision-template-present',
            'docs/decisions/_template.md',
            'docs/decisions/_template.md is missing: the mold sits where the record is written',
        );
    }
}
