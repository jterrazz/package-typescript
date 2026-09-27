import { projectFiles, readText } from './project-files.js';

export const SOURCE = /\.(?:astro|[cm]?[jt]sx?|svelte|vue)$/u;

// A checker reads a directive only at the opening of a comment; prose about one is not one.
const COMMENT = String.raw`(?:\/\/|\/\*+|^\s*\*(?!\/))\s*`;

export const DISABLE = new RegExp(
    `${COMMENT}(?<tool>es|ox)lint-disable(?<scope>-next-line|-line)?(?<tail>[^\n*]*)`,
    'gu',
);

export const TS_DIRECTIVE = new RegExp(
    `${COMMENT}@ts-(?<kind>expect-error|ignore)(?<tail>[^\n*]*)`,
    'gu',
);

// No project of this toolchain runs Biome.
export const BIOME = new RegExp(`${COMMENT}biome-ignore\\b`, 'u');

const QUOTES: ReadonlySet<string> = new Set(['"', "'"]);

type Span = [number, number];

type Reading = { blockStart: number; state: string; templates: number[] };

type Reader = (reading: Reading, line: string, column: number, spans: Span[]) => number;

function readBlock(reading: Reading, line: string, column: number, spans: Span[]): number {
    if (line[column] === '*' && line[column + 1] === '/') {
        spans.push([reading.blockStart, column + 2]);
        reading.state = 'code';

        return column + 2;
    }

    return column + 1;
}

function readTemplate(reading: Reading, line: string, column: number): number {
    const char = line[column];
    if (char === '\\') {
        return column + 2;
    }
    if (char === '`') {
        reading.state = 'code';
    } else if (char === '$' && line[column + 1] === '{') {
        reading.templates.push(0);
        reading.state = 'code';

        return column + 2;
    }

    return column + 1;
}

function readQuoted(reading: Reading, line: string, column: number): number {
    const char = line[column];
    if (char === '\\') {
        return column + 2;
    }
    if (char === reading.state) {
        reading.state = 'code';
    }

    return column + 1;
}

function readBrace(reading: Reading, char: string): void {
    const { templates } = reading;
    if (templates.length === 0) {
        return;
    }
    if (char === '{') {
        templates.push((templates.pop() ?? 0) + 1);
    } else if (templates.at(-1) === 0) {
        templates.pop();
        reading.state = 'template';
    } else {
        templates.push((templates.pop() ?? 0) - 1);
    }
}

function readCode(reading: Reading, line: string, column: number, spans: Span[]): number {
    const char = line[column];
    const next = line[column + 1];
    if (char === '/' && next === '/') {
        spans.push([column, line.length]);

        return line.length;
    }
    if (char === '/' && next === '*') {
        reading.blockStart = column;
        reading.state = 'block';

        return column + 2;
    }
    if (char === '`') {
        reading.state = 'template';
    } else if (char !== undefined && QUOTES.has(char)) {
        reading.state = char;
    } else if (char === '{' || char === '}') {
        readBrace(reading, char);
    }

    return column + 1;
}

const READERS: Readonly<Record<string, Reader>> = {
    block: readBlock,
    code: readCode,
    template: readTemplate,
};

// A directive inside a string is text a program prints, never one a checker reads.
// A regular-expression literal is read as code.
export function commentSpansOf(text: string): Span[][] {
    const reading: Reading = { blockStart: 0, state: 'code', templates: [] };

    return text.split('\n').map((line) => {
        const spans: Span[] = [];
        if (QUOTES.has(reading.state)) {
            reading.state = 'code';
        }
        reading.blockStart = 0;

        let column = 0;
        while (column < line.length) {
            column = (READERS[reading.state] ?? readQuoted)(reading, line, column, spans);
        }
        if (reading.state === 'block') {
            spans.push([reading.blockStart, line.length]);
        }

        return spans;
    });
}

export const isDirective = (comment: string): boolean =>
    comment.search(DISABLE) !== -1 || comment.search(TS_DIRECTIVE) !== -1 || BIOME.test(comment);

const commentsOf = (line: string, spans: readonly Span[]): string[] =>
    spans.map(([start, end]) => line.slice(start, end));

export function countSuppressions(root: string, ignorePatterns: readonly string[] = []): number {
    let found = 0;

    for (const path of projectFiles(root, { ignorePatterns }).filter((file) => SOURCE.test(file))) {
        const text = readText(root, path);
        if (text === null) {
            continue;
        }
        const spans = commentSpansOf(text);
        for (const [index, line] of text.split('\n').entries()) {
            for (const comment of commentsOf(line, spans[index] ?? [])) {
                found +=
                    [...comment.matchAll(DISABLE)].length +
                    [...comment.matchAll(TS_DIRECTIVE)].length +
                    (BIOME.test(comment) ? 1 : 0);
            }
        }
    }

    return found;
}
