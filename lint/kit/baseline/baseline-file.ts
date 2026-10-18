import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { refusal } from '../catalogue/lesson.js';
import { isJsonObject, objectOf } from '../project/json.js';
import { removeLedger } from './ledger-file.js';

export const BASELINE = '.jterrazz/baseline.json';

export type Counts = Record<string, number>;

export type Sections = Record<string, Counts>;

export type ReadBaseline = { problem: null | string; sections: null | Sections };

export const labelOf = (section: string): string => `${BASELINE} › ${section}`;

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
            // Stryker disable next-line StringLiteral: the parser's words are read by a person; specs/cli/check/drift-unreadable-baseline.spec.yaml proves the baseline is refused as unreadable
            problem: `is not JSON: ${error instanceof Error ? error.message : String(error)}`,
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

export function sectionOf(root: string, section: string): Counts | null {
    const { sections } = readBaseline(root);

    return sections?.[section] ?? null;
}

// invariant: a file that is no object of sections keeps its section too: every finding then reads as new debt rather than passing.
export function keepsSection(root: string, section: string): boolean {
    const { problem, sections } = readBaseline(root);

    return problem !== null || (sections !== null && Object.hasOwn(sections, section));
}

const byKey = ([left]: [string, number], [right]: [string, number]): number =>
    left < right ? -1 : 1;

// outside: the formatter owns the indent of a file it formatted, so a rewrite keeps the file's own, and a new file takes the formatter's.
const FORMATTED_INDENT = '    ';

function serialise(counts: Counts, indent: string = FORMATTED_INDENT): string {
    const sorted = Object.fromEntries(Object.entries(counts).toSorted(byKey));

    return JSON.stringify(sorted, null, indent).replaceAll('\n', `\n${indent}`);
}

function indentOf(text: string): string {
    return /\n(?<indent>[ \t]+)"/u.exec(text)?.groups?.indent ?? FORMATTED_INDENT;
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

// invariant: the text has already parsed, so the scan never meets malformed input.
type Member = { end: number; key: string; keyStart: number; start: number };

function membersOf(text: string): Member[] {
    const members: Member[] = [];
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
        members.push({ end, key, keyStart: opening, start });
        index = end;
    }

    return members;
}

export function withSection(text: null | string, name: string, counts: Counts): string {
    const indent = text === null ? FORMATTED_INDENT : indentOf(text);
    const section = serialise(counts, indent);
    const member = `"${name}": ${section}`;
    if (text === null) {
        return `{\n${indent}${member}\n}\n`;
    }

    const own = membersOf(text).find(({ key }) => key === name);
    if (own !== undefined) {
        return `${text.slice(0, own.start)}${section}${text.slice(own.end)}`;
    }

    const open = text.indexOf('{') + 1;
    const rest = text.slice(open);

    return /^\s*\}/u.test(rest)
        ? `${text.slice(0, open)}\n${indent}${member}\n${rest.trimStart()}`
        : `${text.slice(0, open)}\n${indent}${member},\n${indent}${rest.trimStart()}`;
}

function withoutSection(text: string, name: string): null | string {
    const members = membersOf(text);
    const index = members.findIndex(({ key }) => key === name);
    const own = members[index];
    if (own === undefined) {
        return text;
    }
    const next = members[index + 1];
    const previous = members[index - 1];
    if (next !== undefined) {
        return `${text.slice(0, own.keyStart)}${text.slice(next.keyStart)}`;
    }

    return previous === undefined ? null : `${text.slice(0, previous.end)}${text.slice(own.end)}`;
}

function written(path: string, text: null | string): void {
    if (text !== null) {
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, text);

        return;
    }
    removeLedger(path);
}

export function writeSection(root: string, name: string, counts: Counts): void {
    const { problem } = readBaseline(root);
    if (problem !== null) {
        throw new Error(
            refusal({
                fix: `correct ${BASELINE} until it is one JSON object of sections, or delete it, then record again`,
                found: `${BASELINE} ${problem}`,
                read: 'docs/reference/rules-kit.md#the-ratchet-engine',
                why: 'a section is written beside the others, and a file that cannot be read as sections would lose them',
            }),
        );
    }
    const path = join(root, BASELINE);
    const text = existsSync(path) ? readFileSync(path, 'utf8') : null;
    if (Object.keys(counts).length > 0) {
        written(path, withSection(text, name, counts));
    } else if (text !== null) {
        written(path, withoutSection(text, name));
    }
}
