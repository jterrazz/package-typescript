import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const BASELINE = 'jterrazz.baseline.json';

export const SECTION = 'typescript';

export const TEST_SECTION = 'test';

export type Counts = Record<string, number>;

export type Diagnostic = { code?: string; message?: string };

export type Sections = Record<string, Counts>;

export type ReadBaseline = { problem: null | string; sections: null | Sections };

export const labelOf = (section: string): string => `${BASELINE} › ${section}`;

export const LABEL = labelOf(SECTION);

// `@jterrazz/test` records and judges these: its oxlint plugin's rules and its checker's ids.
const TEST_NAMESPACES = ['jterrazz/', 'jterrazz-check/'];

export const isHeldBy = (passes: readonly string[], rule: string): boolean =>
    passes.some((pass) => rule.startsWith(`${pass}/`));

// oxlint's "Unused eslint/oxlint-disable directive" findings carry no `code` at all.
const UNUSED_DIRECTIVE = /^Unused (?:eslint|oxlint)-disable directive/u;

function ruleOf(diagnostic: Diagnostic): string {
    const { code } = diagnostic;
    if (code === undefined && UNUSED_DIRECTIVE.test(diagnostic.message ?? '')) {
        return 'oxlint/unused-directive';
    }
    const match = /^(?<plugin>[\w-]+)\((?<rule>[^)]+)\)$/u.exec(code ?? '');

    return match === null
        ? (code ?? 'unknown')
        : `${match.groups?.plugin ?? ''}/${match.groups?.rule ?? ''}`;
}

export function isTestOwned(rule: string): boolean {
    return TEST_NAMESPACES.some((namespace) => rule.startsWith(namespace));
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === 'object' && !Array.isArray(value);

export function diagnosticsOf(report: unknown): Diagnostic[] {
    if (Array.isArray(report)) {
        return report as Diagnostic[];
    }
    const diagnostics = isRecord(report) ? report.diagnostics : undefined;

    return Array.isArray(diagnostics) ? (diagnostics as Diagnostic[]) : [];
}

export function countsOf(...reports: unknown[]): Counts {
    const counts: Counts = {};
    for (const report of reports) {
        for (const diagnostic of diagnosticsOf(report)) {
            const rule = ruleOf(diagnostic);
            if (!isTestOwned(rule)) {
                counts[rule] = (counts[rule] ?? 0) + 1;
            }
        }
    }

    return counts;
}

export function readBaseline(root: string): ReadBaseline {
    const path = join(root, BASELINE);
    if (!existsSync(path)) {
        return { problem: null, sections: null };
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(readFileSync(path, 'utf8'));
    } catch (error) {
        return {
            problem: `is not JSON — ${error instanceof Error ? error.message : String(error)}`,
            sections: null,
        };
    }
    if (!isRecord(parsed)) {
        return { problem: 'holds no object of sections', sections: null };
    }
    for (const [name, section] of Object.entries(parsed)) {
        if (!isRecord(section)) {
            return {
                problem: `keys \`${name}\` to something that is not a section of counts`,
                sections: null,
            };
        }
    }

    return { problem: null, sections: parsed as Sections };
}

export function sectionOf(root: string, section = SECTION): Counts | null {
    const { sections } = readBaseline(root);

    return sections?.[section] ?? null;
}

// The section is exact: a count above OR below its entry fails, and only `typescript baseline` raises one.
export function judge(counts: Counts, baseline: Counts): string[] {
    const broken: string[] = [];

    for (const [rule, count] of Object.entries(counts).toSorted(([left], [right]) =>
        left < right ? -1 : 1,
    )) {
        const allowed = baseline[rule];
        if (allowed === undefined) {
            broken.push(`${rule} has ${count} diagnostic(s) and no entry — it is new debt`);
        } else if (count > allowed) {
            broken.push(`${rule} is at ${count}, above its baseline of ${allowed}`);
        } else if (count < allowed) {
            broken.push(
                `${rule} is at ${count}, below its baseline of ${allowed} — the debt fell, \`typescript fix\` re-records it`,
            );
        }
    }

    for (const rule of Object.keys(baseline).toSorted()) {
        if (isTestOwned(rule)) {
            broken.push(
                `${rule} is @jterrazz/test's rule — its entry belongs in ${labelOf(TEST_SECTION)}, which that package records and judges`,
            );
        } else if ((counts[rule] ?? 0) === 0) {
            broken.push(`${rule} is at zero — the ratchet moved, delete its entry`);
        }
    }

    return broken;
}

// Lowers what fell and drops zeros, never raises nor adds a key: debt that grew is `typescript baseline`'s to write.
export function tightened(
    counts: Counts,
    baseline: Counts,
    owns: (rule: string) => boolean,
): Counts | undefined {
    const next: Counts = {};
    let fell = false;
    for (const [rule, allowed] of Object.entries(baseline)) {
        const count = owns(rule) ? Math.min(counts[rule] ?? 0, allowed) : allowed;
        fell ||= count < allowed;
        if (count > 0) {
            next[rule] = count;
        }
    }

    return fell ? next : undefined;
}

export function reRecord(
    root: string,
    counts: Counts,
    owns: (rule: string) => boolean,
): { lines: string[]; section: Counts } {
    const held = sectionOf(root) ?? {};
    const next = tightened(counts, held, owns);
    if (next === undefined) {
        return { lines: [], section: held };
    }

    const path = join(root, BASELINE);
    const text = readFileSync(path, 'utf8');
    const written = serialise(next, indentOf(text));
    writeFileSync(path, withSection(text, written));
    const lines = Object.keys(held)
        .toSorted()
        .filter((rule) => (next[rule] ?? 0) !== held[rule])
        .map(
            (rule) =>
                `re-recorded ${LABEL} › ${rule} ${String(held[rule] ?? 0)} → ${String(next[rule] ?? 0)}`,
        );

    return { lines, section: next };
}

export function heldSummary(counts: Counts): string {
    const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
    const rules = Object.keys(counts).length;
    if (rules === 0) {
        return `${LABEL}: nothing held`;
    }

    return `${LABEL}: ${String(total)} held across ${String(rules)} rule${rules === 1 ? '' : 's'}`;
}

// The formatter owns the indent of a file it formatted, so a rewrite keeps the file's own.
export function serialise(counts: Counts, indent = '  '): string {
    const sorted = Object.fromEntries(
        Object.entries(counts).toSorted(([left], [right]) => (left < right ? -1 : 1)),
    );

    return JSON.stringify(sorted, null, indent).replaceAll('\n', `\n${indent}`);
}

function indentOf(text: string): string {
    return /\n(?<indent>[ \t]+)"/u.exec(text)?.groups?.indent ?? '  ';
}

function valueEnd(text: string, start: number): number {
    const first = text[start];
    if (first === '"') {
        return stringEnd(text, start);
    }
    if (first === '{' || first === '[') {
        return containerEnd(text, start);
    }
    const match = /[\s,\]}]/u.exec(text.slice(start));

    return match === null ? text.length : start + match.index;
}

function containerEnd(text: string, start: number): number {
    let depth = 0;
    let index = start;
    while (index < text.length) {
        const char = text[index];
        if (char === '"') {
            index = stringEnd(text, index);
            continue;
        }
        if (char === '{' || char === '[') {
            depth += 1;
        } else if (char === '}' || char === ']') {
            depth -= 1;
            if (depth === 0) {
                return index + 1;
            }
        }
        index += 1;
    }

    return index;
}

function stringEnd(text: string, start: number): number {
    let index = start + 1;
    while (index < text.length && text[index] !== '"') {
        index += text[index] === '\\' ? 2 : 1;
    }

    return index + 1;
}

// The text has already parsed, so the scan never meets malformed input.
function membersOf(text: string): { end: number; key: string; start: number }[] {
    const members: { end: number; key: string; start: number }[] = [];
    let index = text.indexOf('{') + 1;
    while (index < text.length) {
        const opening = text.indexOf('"', index);
        const closing = text.indexOf('}', index);
        if (opening === -1 || (closing !== -1 && closing < opening)) {
            break;
        }
        const keyEnd = stringEnd(text, opening);
        const key = JSON.parse(text.slice(opening, keyEnd)) as string;
        let start = text.indexOf(':', keyEnd) + 1;
        while (/\s/u.test(text[start] ?? '')) {
            start += 1;
        }
        const end = valueEnd(text, start);
        members.push({ end, key, start });
        index = end;
    }

    return members;
}

export function withSection(text: null | string, section: string): string {
    const member = `"${SECTION}": ${section}`;
    if (text === null) {
        return `{\n  ${member}\n}\n`;
    }

    const own = membersOf(text).find(({ key }) => key === SECTION);
    if (own !== undefined) {
        return `${text.slice(0, own.start)}${section}${text.slice(own.end)}`;
    }

    const open = text.indexOf('{') + 1;
    const rest = text.slice(open);

    return /^\s*\}/u.test(rest)
        ? `${text.slice(0, open)}\n  ${member}\n${rest.trimStart()}`
        : `${text.slice(0, open)}\n  ${member},\n  ${rest.trimStart()}`;
}
