import { readFileSync } from 'node:fs';

import { parsedObject } from '../../lint/kit/project/json.js';
import type { JsonObject } from '../../lint/kit/project/json.js';

type Step = { kept: string; next: number; open: boolean };

// A comment marker inside a string (`"**/*.js"`) is data.
function withoutComments(text: string): string {
    let output = '';
    let index = 0;
    let inString = false;

    while (index < text.length) {
        const char = text[index] ?? '';

        if (inString) {
            const step = inStringStep(text, index);
            output += step.kept;
            inString = step.open;
            index = step.next;
        } else if (char === '"') {
            inString = true;
            output += char;
            index += 1;
        } else if (text.startsWith('//', index)) {
            index = afterLine(text, index);
        } else if (text.startsWith('/*', index)) {
            index = afterBlock(text, index);
        } else {
            output += char;
            index += 1;
        }
    }

    return output;
}

function inStringStep(text: string, index: number): Step {
    const char = text[index] ?? '';
    const escaped = char === '\\';

    return {
        kept: escaped ? char + (text[index + 1] ?? '') : char,
        next: index + (escaped ? 2 : 1),
        open: escaped || char !== '"',
    };
}

function afterLine(text: string, index: number): number {
    const end = text.indexOf('\n', index);

    return end === -1 ? text.length : end;
}

function afterBlock(text: string, index: number): number {
    const end = text.indexOf('*/', index + 2);

    return end === -1 ? text.length : end + 2;
}

function closesCollection(text: string, index: number): boolean {
    if (text[index] !== ',') {
        return false;
    }

    let next = index + 1;
    while (next < text.length && (text[next] ?? '').trim() === '') {
        next += 1;
    }

    return text[next] === ']' || text[next] === '}';
}

function withoutTrailingCommas(text: string): string {
    let output = '';
    let index = 0;
    let inString = false;

    while (index < text.length) {
        const char = text[index] ?? '';
        const closes = closesCollection(text, index);

        if (inString) {
            const step = inStringStep(text, index);
            output += step.kept;
            inString = step.open;
            index = step.next;
        } else {
            inString = char === '"';
            output += closes ? '' : char;
            index += 1;
        }
    }

    return output;
}

// JSONC, so an ignore carries its reason beside it.
export function readJsonc(path: string): JsonObject {
    const document = readFileSync(path, 'utf8');

    return parsedObject(withoutTrailingCommas(withoutComments(document)));
}
