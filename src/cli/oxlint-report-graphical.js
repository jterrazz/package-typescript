import { drawFrames } from './oxlint-report-frame.js';
import { styled, textWidth } from './oxlint-report-theme.js';

// oxlint's own numbers: prose wraps at 400 columns, and a frame line of 1 200 bytes or more names
// its file as minified and stops there.
const WIDTH = 400;
const MINIFIED_LINE_BYTES = 1200;

// First fit, as oxlint wraps: a word keeps the spaces after it, a line ends on its last word.
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

function fillIndented(text, width, initial, rest) {
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

    return `${fillIndented(text, WIDTH - 2, `  ${styled(icon, style)} `, `  ${styled(chars.vbar, style)} `)}\n`;
}

function footer({ styles }, diagnostic) {
    let text = '';
    const width = WIDTH - 4;
    if (diagnostic.help !== undefined) {
        const { help } = diagnostic;
        const prefix = '  help: ';
        text +=
            !help.includes('\n') && Buffer.byteLength(prefix) + Buffer.byteLength(help) <= width
                ? `${styled(prefix, styles.help)}${help.replace(/ +$/u, '')}\n`
                : `${fillIndented(help, width, styled(prefix, styles.help), ' '.repeat(8))}\n`;
    }
    if (diagnostic.note !== undefined) {
        text += `${fillIndented(diagnostic.note, width, styled('  note: ', styles.note), ' '.repeat(11))}\n`;
    }

    return text;
}

function drawReport(theme, diagnostic, source) {
    return `\n${title(theme, diagnostic)}${drawFrames(theme, diagnostic, source) ?? ''}${footer(theme, diagnostic)}`;
}

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
