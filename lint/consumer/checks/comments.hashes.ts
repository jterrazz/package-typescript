import type { Run } from './comments.js';

type Carrier = { heredoc?: string | undefined; scalarIndent?: number | undefined };

const HEREDOC = /<<-?\s*(?<quote>['"]?)(?<word>\w+)\k<quote>/u;

// outside: YAML opens a block scalar on `|` or `>` after a key's `: ` or a list item's `- `, its chomping and indentation indicators after it.
const BLOCK_SCALAR = /^(?<indent> *)(?:- +)*(?:[^#\s][^#]*?: +)?[|>][-+]?\d?(?: +#.*)?$/u;

const indentOf = (line: string): number => line.length - line.trimStart().length;

// invariant: a blank line is no comment and opens nothing; a line inside a heredoc or a YAML block scalar is the text it carries.
function isCarried(carrier: Carrier, line: string): boolean {
    const body = line.trim();
    if (carrier.heredoc !== undefined) {
        if (body === carrier.heredoc) {
            carrier.heredoc = undefined;
        }
        return true;
    }
    if (body === '' || indentOf(line) > (carrier.scalarIndent ?? Number.POSITIVE_INFINITY)) {
        return true;
    }
    carrier.scalarIndent = undefined;

    return false;
}

function openCarrier(carrier: Carrier, line: string): void {
    const { word } = HEREDOC.exec(line)?.groups ?? {};
    const { indent } = BLOCK_SCALAR.exec(line)?.groups ?? {};
    carrier.heredoc = word;
    carrier.scalarIndent = indent?.length;
}

function openingOf(body: string): string {
    let at = 0;
    while (body.charAt(at) === '#') {
        at += 1;
    }

    return body.slice(at).trimStart();
}

/** The runs of `#` lines of a script, a Makefile, a Dockerfile or a YAML file, a shebang aside. */
export function commentsOfHashes(text: string): Run[] {
    const runs: Run[] = [];
    const carrier: Carrier = {};
    let offset = 0;
    let previous: Run | undefined;
    for (const [index, line] of text.split('\n').entries()) {
        const start = offset;
        offset += line.length + 1;
        const body = line.trimStart();
        if (isCarried(carrier, line)) {
            previous = undefined;
        } else if (!body.startsWith('#') || (index === 0 && body.startsWith('#!'))) {
            openCarrier(carrier, line);
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
