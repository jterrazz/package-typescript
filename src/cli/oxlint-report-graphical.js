/**
 * oxlint's framed report, drawn from its JSON one: per diagnostic a blank
 * line, the title, the source frames and the help and note beneath — and a
 * file whose frames carry a line of 1 200 bytes or more stops there and is
 * named as a minified file instead, the way oxlint cuts one short.
 *
 * Prose wraps at oxlint's width of 400 columns; a text that fits, or that
 * breaks only where it already breaks, keeps every word where it was.
 */

import { drawFrames } from './oxlint-report-frame.js';
import { styled, textWidth } from './oxlint-report-theme.js';

const WIDTH = 400;
const MINIFIED_LINE_BYTES = 1200;

/**
 * One line of prose wrapped at `width` columns, first fit: a word keeps the
 * spaces after it, a line keeps the spaces it opens with, and a line ends on
 * its last word, its trailing spaces dropped.
 */
function wrapLine(line, width) {
    const words = line.match(/[^ ]*(?: +|$)/gu)?.filter((word) => word !== '') ?? [];
    const lines = [];
    let current = '';
    for (const word of words) {
        const candidate = `${current}${word}`;
        if (current !== '' && textWidth(candidate.replace(/ +$/u, '')) > width) {
            lines.push(current.replace(/ +$/u, ''));
            current = word;
        } else {
            current = candidate;
        }
    }

    return [...lines, current.replace(/ +$/u, '')];
}

/** Prose laid under an opening indent, every further line under the rest indent. */
function fill(text, width, initial, rest) {
    const fits =
        !text.includes('\n') &&
        (Buffer.byteLength(initial) + Buffer.byteLength(text) <= width ||
            textWidth(text) <= width - textWidth(initial));
    if (fits) {
        return `${initial}${text.replace(/ +$/u, '')}`;
    }
    const lines = text
        .split('\n')
        .flatMap((line, index) => wrapLine(line, width - textWidth(index === 0 ? initial : rest)));

    return lines.map((line, index) => `${index === 0 ? initial : rest}${line}`).join('\n');
}

const SEVERITY_STYLE = { advice: 'advice', error: 'error', warning: 'warning' };

/** The title line: the severity mark, the rule, and the message. */
function title({ chars, styles }, diagnostic) {
    const kind = SEVERITY_STYLE[diagnostic.severity] ?? 'error';
    const style = styles[kind];
    const icon = chars[kind];
    const plain =
        diagnostic.code === undefined
            ? diagnostic.message
            : `${diagnostic.code}: ${diagnostic.message}`;
    const text = styled(plain, style);
    if (
        !text.includes('\n') &&
        Buffer.byteLength(icon) + Buffer.byteLength(text) + 3 <= WIDTH - 2
    ) {
        return `  ${styled(icon, style)} ${text.replace(/ +$/u, '')}\n`;
    }

    return `${fill(text, WIDTH - 2, `  ${styled(icon, style)} `, `  ${styled(chars.vbar, style)} `)}\n`;
}

/** The help and the note under a diagnostic, where it carries them. */
function footer({ styles }, diagnostic) {
    let text = '';
    const width = WIDTH - 4;
    if (diagnostic.help !== undefined) {
        const { help } = diagnostic;
        const prefix = '  help: ';
        text +=
            !help.includes('\n') && Buffer.byteLength(prefix) + Buffer.byteLength(help) <= width
                ? `${styled(prefix, styles.help)}${help.replace(/ +$/u, '')}\n`
                : `${fill(help, width, styled(prefix, styles.help), ' '.repeat(8))}\n`;
    }
    if (diagnostic.note !== undefined) {
        text += `${fill(diagnostic.note, width, styled('  note: ', styles.note), ' '.repeat(11))}\n`;
    }

    return text;
}

/** One diagnostic, framed. */
function drawReport(theme, diagnostic, source) {
    return `\n${title(theme, diagnostic)}${drawFrames(theme, diagnostic, source) ?? ''}${footer(theme, diagnostic)}`;
}

/** Diagnostics in report order, cut into the runs that name one file after another. */
function batchesOf(diagnostics) {
    const batches = [];
    for (const diagnostic of diagnostics) {
        const last = batches.at(-1);
        if (last !== undefined && last[0]?.filename === diagnostic.filename) {
            last.push(diagnostic);
        } else {
            batches.push([diagnostic]);
        }
    }

    return batches;
}

function tooLong(rendered) {
    return rendered
        .split('\n')
        .some((line) => Buffer.byteLength(line.replace(/\r$/u, '')) >= MINIFIED_LINE_BYTES);
}

/** Every diagnostic, framed; `sourceOf(filename)` hands back the file each one points into. */
export function drawGraphical(theme, diagnostics, sourceOf) {
    let text = '';
    for (const batch of batchesOf(diagnostics)) {
        for (const diagnostic of batch) {
            const rendered = drawReport(theme, diagnostic, sourceOf(diagnostic.filename));
            if (tooLong(rendered)) {
                const help =
                    diagnostic.filename === undefined
                        ? undefined
                        : `${diagnostic.filename} seems like a minified file`;
                text += drawReport(theme, {
                    help,
                    message: 'File is too long to fit on the screen',
                    severity: 'warning',
                });
                break;
            }
            text += rendered;
        }
    }

    return text;
}
