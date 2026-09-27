import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { refusal } from '../catalogue/lesson.js';
import { isJsonObject, objectOf } from '../project/json.js';

export const BASELINE = 'jterrazz.baseline.json';

export const SECTION = 'typescript';

export const TEST_SECTION = 'test';

export type Counts = Record<string, number>;

export type Sections = Record<string, Counts>;

export type ReadBaseline = { problem: null | string; sections: null | Sections };

export const labelOf = (section: string): string => `${BASELINE} › ${section}`;

export const LABEL = labelOf(SECTION);

export const isHeldBy = (passes: readonly string[], rule: string): boolean =>
    passes.some((pass) => rule.startsWith(`${pass}/`));

function countsIn(section: unknown): Counts | null {
    const entries = Object.entries(objectOf(section));
    const counted = entries.filter(
        (entry): entry is [string, number] => typeof entry[1] === 'number',
    );

    return isJsonObject(section) && counted.length === entries.length
        ? Object.fromEntries(counted)
        : null;
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
    if (!isJsonObject(parsed)) {
        return { problem: 'holds no object of sections', sections: null };
    }
    const sections: Sections = {};
    for (const [name, section] of Object.entries(parsed)) {
        const counts = countsIn(section);
        if (counts === null) {
            return {
                problem: `keys \`${name}\` to something that is not a section of counts`,
                sections: null,
            };
        }
        sections[name] = counts;
    }

    return { problem: null, sections };
}

export function sectionOf(root: string, section = SECTION): Counts | null {
    const { sections } = readBaseline(root);

    return sections?.[section] ?? null;
}

export type Broken = { refusal: string; rule: string };

const RECORD = "fix the findings, or run 'typescript baseline' to record where the project stands";

// The section is exact: a count above OR below its entry fails, and only `typescript baseline` raises one.
export function judge(counts: Counts, baseline: Counts): Broken[] {
    const broken: Broken[] = [];

    for (const [rule, count] of Object.entries(counts).toSorted(([left], [right]) =>
        left < right ? -1 : 1,
    )) {
        const allowed = baseline[rule];
        if (allowed === undefined) {
            broken.push({
                refusal: refusal({
                    fix: RECORD,
                    found: `\`${rule}\` has ${String(count)} finding(s) and no entry records them`,
                    read: 'docs/06-quality-checks.md#what-jterrazzbaselinejson-still-holds',
                    why: 'the section holds the debt the project recorded, and a finding no entry holds is new debt',
                }),
                rule,
            });
        } else if (count > allowed) {
            broken.push({
                refusal: refusal({
                    fix: RECORD,
                    found: `\`${rule}\` is at ${String(count)}, above its baseline of ${String(allowed)}`,
                    read: 'docs/06-quality-checks.md#what-jterrazzbaselinejson-still-holds',
                    why: 'each count is held exactly, and a count above its entry is a regression',
                }),
                rule,
            });
        } else if (count < allowed) {
            broken.push({
                refusal: refusal({
                    fix: "run 'typescript fix', which re-records the fall",
                    found: `\`${rule}\` is at ${String(count)}, below its baseline of ${String(allowed)}`,
                    read: 'docs/06-quality-checks.md#what-jterrazzbaselinejson-still-holds',
                    why: 'each count is held exactly, so a debt that fell is recorded the day it falls and cannot grow back unseen',
                }),
                rule,
            });
        }
    }

    for (const rule of Object.keys(baseline).toSorted()) {
        if ((counts[rule] ?? 0) === 0) {
            broken.push({
                refusal: refusal({
                    fix: "run 'typescript fix', which deletes the entry",
                    found: `\`${rule}\` is at zero, and its entry is still recorded`,
                    read: 'docs/06-quality-checks.md#what-jterrazzbaselinejson-still-holds',
                    why: 'an entry with nothing left to hold would let the debt grow back to its old count unseen',
                }),
                rule,
            });
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
        const quoted: unknown = JSON.parse(text.slice(opening, keyEnd));
        const key = typeof quoted === 'string' ? quoted : '';
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
