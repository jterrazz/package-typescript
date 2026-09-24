/**
 * The marks a framed diagnostic draws beside and under a source line: the
 * gutter that joins the ends of a multi-line span, the underline of a span on
 * one line, and the label text hanging off either — oxlint's layout, column
 * for column, in the theme it was given.
 *
 * A span here is a label placed on the source: its byte `offset`, byte
 * `length`, optional `label` text and the highlight `style` it is drawn in.
 */

import { charWidths, codePointsOf, styled } from './oxlint-report-theme.js';

/** Whether a span begins and ends inside a line. */
export function lineOnly(line, span) {
    return span.offset >= line.offset && span.offset + span.length <= line.offset + line.length;
}

/** Whether a span touches a line at all: starts on it, crosses it, or ends on it. */
export function applies(line, span) {
    const end = span.offset + Math.max(span.length, 1);
    const lineEnd = line.offset + line.length;

    return (
        (span.offset >= line.offset && span.offset < lineEnd) ||
        (span.offset < line.offset && end > lineEnd) ||
        (end > line.offset && end <= lineEnd)
    );
}

/** Whether a span draws in a line's gutter: it touches the line and does not both start and end on it. */
export function appliesGutter(line, span) {
    const end = span.offset + Math.max(span.length, 1);
    const lineEnd = line.offset + line.length;
    const startsHere = span.offset >= line.offset && span.offset < lineEnd;
    const endsHere = end > line.offset && end <= lineEnd;

    return applies(line, span) && !(startsHere && endsHere);
}

function flyby(line, span) {
    return span.offset < line.offset && span.offset + span.length > line.offset + line.length;
}

export function starts(line, span) {
    return span.offset >= line.offset;
}

export function ends(line, span) {
    const end = span.offset + span.length;

    return end >= line.offset && end <= line.offset + line.length;
}

/** The column a byte offset of a line is drawn at, rounding inside a character toward `start`. */
function visualOffset(line, offset, start) {
    let index = offset - line.offset;
    while (
        index <= line.bytes.length &&
        index > 0 &&
        index < line.bytes.length &&
        isContinuation(line.bytes[index])
    ) {
        index += start ? -1 : 1;
    }
    const text = line.bytes.subarray(0, Math.min(index, line.bytes.length)).toString('utf8');
    const width = charWidths(text).reduce((sum, columns) => sum + columns, 0);

    return index > line.bytes.length ? width + 1 : width;
}

function isContinuation(byte) {
    return byte !== undefined && byte >= 0x80 && byte < 0xc0;
}

/** The gutter drawn on a source line: where each multi-line span starts, crosses or ends. */
export function lineGutter({ chars }, { maxGutter, spans }, line) {
    if (maxGutter === 0) {
        return '';
    }
    let gutter = '';
    let arrow = false;
    for (const [index, span] of spans
        .filter((candidate) => appliesGutter(line, candidate))
        .entries()) {
        const bar = styled(chars.hbar.repeat(Math.max(maxGutter - index, 0)), span.style);
        if (starts(line, span)) {
            gutter += `${styled(chars.ltop, span.style)}${bar}${styled(chars.rarrow, span.style)}`;
            arrow = true;
            break;
        }
        if (ends(line, span)) {
            const corner = span.label === undefined ? chars.lbot : chars.lcross;
            gutter += `${styled(corner, span.style)}${bar}${styled(chars.rarrow, span.style)}`;
            arrow = true;
            break;
        }
        gutter += flyby(line, span) ? styled(chars.vbar, span.style) : ' ';
    }

    return `${gutter}${' '.repeat((arrow ? 1 : 3) + Math.max(maxGutter - codePointsOf(gutter).length, 0))}`;
}

/** The gutter drawn on a line of marks under a source line; `mode` is how a label line is laid out. */
export function highlightGutter({ chars }, { maxGutter, spans }, line, mode) {
    if (maxGutter === 0) {
        return '';
    }
    let gutter = '';
    let columns = 0;
    for (const [index, span] of spans
        .filter((candidate) => appliesGutter(line, candidate))
        .entries()) {
        if (!lineOnly(line, span) && ends(line, span)) {
            const repeat = Math.max(maxGutter - index, 0) + 2;
            if (mode === 'rest') {
                gutter += ' '.repeat(repeat);
            } else {
                const bar = chars.hbar.repeat(repeat - (mode === 'first' ? 1 : 0));
                gutter += `${styled(chars.lbot, span.style)}${styled(bar, span.style)}`;
            }
            columns += repeat + 1;
            break;
        }
        gutter += styled(chars.vbar, span.style);
        columns += 1;
    }

    return `${gutter}${' '.repeat(Math.max(maxGutter + 3 - columns, 0))}`;
}

/** One line of label text, in the corner shape its place in the label calls for. */
function labelLine({ chars }, text, style, mode) {
    const body = styled(text, style);
    const opening = {
        first: `${chars.lbot}${chars.hbar}${chars.rcross} ${body}`,
        rest: `  ${chars.vbar} ${body}`,
        single: `${chars.lbot}${chars.hbar}${chars.hbar} ${body}`,
    }[mode];

    return styled(opening, style);
}

/** A label's text as the lines it is drawn on, each with its layout mode. */
export function labelLines(label) {
    const [first = '', ...rest] = label.split('\n');

    return [
        { mode: rest.length > 0 ? 'first' : 'single', text: first },
        ...rest.map((text) => ({ mode: 'rest', text })),
    ];
}

/**
 * The underline under the spans that start and end on a line, then the label
 * of each, the last span's first — every label hanging from the middle of its
 * underline, crossing the bars of the spans to its left.
 */
export function singleLineMarks(theme, frame, line, onLine) {
    const { chars } = theme;
    let highest = 0;
    let underline = '';
    const bars = [];
    for (const span of onLine) {
        const start = Math.max(visualOffset(line, span.offset, true), highest);
        const end =
            span.length === 0
                ? start + 1
                : Math.max(visualOffset(line, span.offset + span.length, false), start + 1);
        const middle = Math.floor((start + end) / 2);
        const marker =
            span.length === 0
                ? chars.uarrow
                : span.label === undefined
                  ? chars.underline
                  : chars.underbar;
        const drawn = `${' '.repeat(Math.max(start - highest, 0))}${chars.underline.repeat(middle - start)}${marker}${chars.underline.repeat(end - middle - 1)}`;
        underline += styled(drawn, span.style);
        highest = Math.max(highest, end);
        bars.push({ middle, span });
    }

    let text = `${underline}\n`;
    for (const span of onLine.toReversed()) {
        for (const { mode, text: labelText } of span.label === undefined
            ? []
            : labelLines(span.label)) {
            text += frame.noLinum + highlightGutter(theme, frame, line, 'single');
            text += `${hangingLabel(theme, bars, span, { mode, text: labelText })}\n`;
        }
    }

    return text;
}

/** The bars left of a label, then the label itself at its span's middle column. */
function hangingLabel(theme, bars, span, { mode, text }) {
    let drawn = '';
    let column = 1;
    for (const bar of bars) {
        const padding = Math.max(bar.middle + 1 - column, 0);
        drawn += ' '.repeat(padding);
        column += padding;
        if (sameSpan(bar.span, span)) {
            return drawn + labelLine(theme, text, span.style, mode);
        }
        drawn += styled(theme.chars.vbar, bar.span.style);
        column += 1;
    }

    return drawn;
}

/** Two spans are one when they cover the same bytes under the same label. */
function sameSpan(left, right) {
    return (
        left.offset === right.offset && left.length === right.length && left.label === right.label
    );
}

/** The label of a multi-line span, drawn on the line where the span ends. */
export function multiLineEnd(theme, frame, line, span) {
    const { chars } = theme;
    const corner = { first: chars.rcross, rest: chars.vbar, single: chars.hbar };

    return labelLines(span.label ?? '')
        .map(
            ({ mode, text }) =>
                `${frame.noLinum}${highlightGutter(theme, frame, line, mode)}` +
                `${styled(corner[mode], span.style)} ${styled(text, span.style)}\n`,
        )
        .join('');
}
