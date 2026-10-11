import type { Run } from './comments.js';

// outside: the go tool reads these comments: build constraints, generator and linker directives, the linter's switch, the cgo preamble marker.
export const GO_INSTRUCTION =
    /^(?:go:|\+build\b|nolint\b|lint:|export\b|line\b|golangci-lint\b|Code generated\b|#cgo\b)/u;

// outside: godoc reads a comment directly above a package clause, or above the declaration of an exported name, as that name's documentation, which an editor shows on hover; a name inside a `const (` or `var (` block is declared on a line of its own.
const DOCUMENTED =
    /^(?:package\s|(?:func\s+(?:\([^)]*\)\s*)?|type\s+|var\s+|const\s+)\p{Lu}|\s+\p{Lu}\w*(?:\s|=|,|$))/u;

type Piece = Run & { first: number; isBlock: boolean; isOwnLine: boolean };

const linesIn = (text: string): number => (text.match(/\n/gu) ?? []).length;

// invariant: a string, a raw string and a rune are read whole first, so a comment marker inside one opens nothing.
function skipQuoted(text: string, from: number, quote: string): number {
    const stops = quote === '`' ? quote : `${quote}\n`;
    let at = from + 1;
    while (at < text.length && !stops.includes(text.charAt(at))) {
        at += text.charAt(at) === '\\' && quote !== '`' ? 2 : 1;
    }

    return at + 1;
}

function piecesOf(text: string): Piece[] {
    const pieces: Piece[] = [];
    let at = 0;
    let line = 0;
    let lineStart = 0;
    while (at < text.length) {
        const char = text.charAt(at);
        const pair = text.slice(at, at + 2);
        if (char === '\n') {
            line += 1;
            lineStart = at + 1;
            at += 1;
        } else if (char === '"' || char === "'" || char === '`') {
            const stop = skipQuoted(text, at, char);
            line += linesIn(text.slice(at, stop));
            at = stop;
        } else if (pair === '//' || pair === '/*') {
            const isBlock = pair === '/*';
            const close = isBlock ? text.indexOf('*/', at + 2) : text.indexOf('\n', at);
            const stop = close === -1 ? text.length : close + (isBlock ? 2 : 0);
            pieces.push({
                end: stop,
                first: line,
                isBlock,
                isOwnLine: text.slice(lineStart, at).trim() === '',
                opening: text.slice(at + 2, stop).trimStart(),
                start: at,
            });
            line += linesIn(text.slice(at, stop));
            at = stop;
        } else {
            at += 1;
        }
    }

    return pieces;
}

type Joined = Piece & { last: number };

function joinedRuns(text: string): Joined[] {
    const runs: Joined[] = [];
    for (const piece of piecesOf(text)) {
        const previous = runs.at(-1);
        const last = piece.first + linesIn(text.slice(piece.start, piece.end));
        if (
            previous !== undefined &&
            !previous.isBlock &&
            !piece.isBlock &&
            piece.isOwnLine &&
            previous.last === piece.first - 1
        ) {
            previous.end = piece.end;
            previous.last = last;
        } else {
            runs.push({ ...piece, last });
        }
    }

    return runs;
}

/** The comments of a Go file that godoc reads as no documentation: a `//` run or a block that does not stand directly above the package clause or an exported declaration. */
export function commentsOfGo(text: string): Run[] {
    const lines = text.split('\n');

    return joinedRuns(text)
        .filter(({ isOwnLine, last }) => !(isOwnLine && DOCUMENTED.test(lines[last + 1] ?? '')))
        .map(({ end, opening, start }) => ({ end, opening, start }));
}
