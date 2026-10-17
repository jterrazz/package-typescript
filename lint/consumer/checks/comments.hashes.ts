import type { Run } from './comments.js';

type Dialect = 'docker' | 'make' | 'shell' | 'yaml';

type Quote = "'" | '"';

type Carrier = {
    defines: number;
    heredoc?: string | undefined;
    quote?: Quote | undefined;
    scalarIndent?: number | undefined;
};

const HEREDOC = /<<-?\s*(?<quote>['"]?)(?<word>\w+)\k<quote>/u;

// outside: YAML opens a block scalar on `|` or `>` after a key's `: ` or a list item's `- `, its chomping and indentation indicators after it.
const BLOCK_SCALAR = /^(?<indent> *)(?:- +)*(?:[^#\s][^#]*?: +)?[|>][-+]?\d?(?: +#.*)?$/u;

// outside: GNU make opens a multi-line variable on `define`, its modifiers before it, and closes it on `endef`; one may nest in another.
const DEFINE = /^\s*(?:(?:export|override|private)\s+)*define\s+\S/u;

const ENDEF = /^\s*endef\b/u;

// outside: a YAML quoted scalar opens only where a value starts (the line's indentation, a list item's `- `, a key's `: `); every part is optional, so the lead matches at the line's start.
const YAML_LEAD = / *(?:- +)*(?:[^#\s'"][^#]*?: +)?/u;

const WORD_END = /(?:^|\s)$/u;

const indentOf = (line: string): number => line.length - line.trimStart().length;

const isQuote = (char: string): char is Quote => char === '"' || char === "'";

function dialectOf(path: string): Dialect {
    if (/\.ya?ml$/u.test(path)) {
        return 'yaml';
    }
    if (/(?:^|\/)(?:GNUm|M)akefile$|\.mk$/u.test(path)) {
        return 'make';
    }

    // Stryker disable next-line StringLiteral: a Dockerfile's dialect is read only as no shell's, which any other name is too
    return /(?:^|\/)Dockerfile(?:\.[\w.-]+)?$|\.dockerfile$/u.test(path) ? 'docker' : 'shell';
}

// invariant: a `\` escapes the next character outside a quote and inside a double one; a single quote escapes nothing.
function stepOfShell(line: string, at: number, quote: Quote | undefined): number {
    const char = line.charAt(at);

    return char === '\\' && quote !== "'" ? at + 2 : at + 1;
}

// invariant: outside a quote, a `#` opening a word opens the line's comment, whose quotes open nothing.
function shellQuoteAfter(line: string, open: Quote | undefined): Quote | undefined {
    let quote = open;
    let at = 0;
    // Stryker disable next-line EqualityOperator: past the line's end no character opens or closes a quote
    while (at < line.length) {
        const char = line.charAt(at);
        if (quote === undefined && char === '#' && WORD_END.test(line.slice(0, at))) {
            return undefined;
        }
        if (quote === undefined && isQuote(char)) {
            quote = char;
        } else if (char === quote) {
            quote = undefined;
        }
        at = stepOfShell(line, at, quote);
    }

    return quote;
}

// invariant: a double-quoted YAML scalar escapes with `\`, a single-quoted one doubles its quote; what follows the closing quote opens nothing.
function yamlCloses(text: string, quote: Quote): boolean {
    let at = 0;
    // Stryker disable next-line EqualityOperator: past the text's end no character closes a quote
    while (at < text.length) {
        const char = text.charAt(at);
        if (quote === '"' && char === '\\') {
            at += 2;
        } else if (char === quote && quote === "'" && text.charAt(at + 1) === "'") {
            at += 2;
        } else if (char === quote) {
            return true;
        } else {
            at += 1;
        }
    }

    return false;
}

function yamlQuoteAfter(line: string, open: Quote | undefined): Quote | undefined {
    if (open !== undefined) {
        return yamlCloses(line, open) ? undefined : open;
    }
    const value = line.replace(YAML_LEAD, '');
    const first = value.charAt(0);

    return isQuote(first) && !yamlCloses(value.slice(1), first) ? first : undefined;
}

// invariant: a Dockerfile drops its `#` lines before RUN reads them, and a make line outside a recipe quotes nothing.
function quoteAfter(dialect: Dialect, line: string, open?: Quote): Quote | undefined {
    if (dialect === 'yaml') {
        return yamlQuoteAfter(line, open);
    }
    const quotes =
        dialect === 'shell' ||
        (dialect === 'make' && (open !== undefined || line.startsWith('\t')));

    return quotes ? shellQuoteAfter(line, open) : undefined;
}

function definesAfter(defines: number, line: string): number {
    if (DEFINE.test(line)) {
        return defines + 1;
    }

    return ENDEF.test(line) ? defines - 1 : defines;
}

// invariant: a blank line is no comment and opens nothing; a line inside a heredoc, a quoted string, a make `define` or a YAML block scalar is the text it carries.
function isCarried(carrier: Carrier, line: string, dialect: Dialect): boolean {
    const body = line.trim();
    if (carrier.heredoc !== undefined) {
        if (body === carrier.heredoc) {
            carrier.heredoc = undefined;
        }
        return true;
    }
    if (carrier.quote !== undefined) {
        carrier.quote = quoteAfter(dialect, line, carrier.quote);
        return true;
    }
    if (carrier.defines > 0) {
        carrier.defines = definesAfter(carrier.defines, line);
        return true;
    }
    if (body === '' || indentOf(line) > (carrier.scalarIndent ?? Number.POSITIVE_INFINITY)) {
        return true;
    }
    carrier.scalarIndent = undefined;

    return false;
}

function openCarrier(carrier: Carrier, line: string, dialect: Dialect): void {
    const { word } = HEREDOC.exec(line)?.groups ?? {};
    const { indent } = BLOCK_SCALAR.exec(line)?.groups ?? {};
    carrier.heredoc = word;
    carrier.scalarIndent = indent?.length;
    carrier.quote = quoteAfter(dialect, line);
    carrier.defines = dialect === 'make' && DEFINE.test(line) ? 1 : 0;
}

function openingOf(body: string): string {
    let at = 0;
    while (body.charAt(at) === '#') {
        at += 1;
    }

    return body.slice(at).trimStart();
}

/** The runs of `#` lines of a script, a Makefile, a Dockerfile or a YAML file, a shebang aside. */
export function commentsOfHashes(text: string, path: string): Run[] {
    const dialect = dialectOf(path);
    const runs: Run[] = [];
    // Stryker disable next-line ObjectLiteral: a carrier's defines are read only once a line has opened it, which sets them
    const carrier: Carrier = { defines: 0 };
    let offset = 0;
    let previous: Run | undefined;
    for (const [index, line] of text.split('\n').entries()) {
        const start = offset;
        offset += line.length + 1;
        const body = line.trimStart();
        if (isCarried(carrier, line, dialect)) {
            previous = undefined;
        } else if (!body.startsWith('#') || (index === 0 && body.startsWith('#!'))) {
            openCarrier(carrier, line, dialect);
            previous = undefined;
        } else if (previous === undefined) {
            previous = {
                end: start + line.length,
                opening: openingOf(body),
                start: start + indentOf(line),
            };
            runs.push(previous);
        } else {
            previous.end = start + line.length;
        }
    }

    return runs;
}
