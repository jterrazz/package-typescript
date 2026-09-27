import type { Line } from './source.js';
import { charWidths, codePointsOf, styled } from './theme.js';
import type { Theme } from './theme.js';

export type Label = { label?: string | undefined; length: number; offset: number };

export type MarkedSpan = Label & { style: string };

export type Frame = { linumWidth: number; maxGutter: number; noLinum: string; spans: MarkedSpan[] };

type LabelLayout = 'first' | 'rest' | 'single';

type Bar = { middle: number; span: MarkedSpan };

export function spanWithinLine(line: Line, span: Label): boolean {
    return span.offset >= line.offset && span.offset + span.length <= line.offset + line.length;
}

export function spanTouchesLine(line: Line, span: Label): boolean {
    const end = span.offset + Math.max(span.length, 1);
    const lineEnd = line.offset + line.length;

    return (
        (span.offset >= line.offset && span.offset < lineEnd) ||
        (span.offset < line.offset && end > lineEnd) ||
        (end > line.offset && end <= lineEnd)
    );
}

export function spanDrawsInGutter(line: Line, span: Label): boolean {
    const end = span.offset + Math.max(span.length, 1);
    const lineEnd = line.offset + line.length;
    const startsHere = span.offset >= line.offset && span.offset < lineEnd;
    const endsHere = end > line.offset && end <= lineEnd;

    return spanTouchesLine(line, span) && !(startsHere && endsHere);
}

function spanCrossesLine(line: Line, span: Label): boolean {
    return span.offset < line.offset && span.offset + span.length > line.offset + line.length;
}

export function starts(line: Line, span: Label): boolean {
    return span.offset >= line.offset;
}

export function ends(line: Line, span: Label): boolean {
    const end = span.offset + span.length;

    return end >= line.offset && end <= line.offset + line.length;
}

// Rounds inside a multi-byte character toward `start`.
function visualOffset(line: Line, offset: number, start: boolean): number {
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

function isContinuation(byte: number | undefined): boolean {
    return byte !== undefined && byte >= 0x80 && byte < 0xc0;
}

export function lineGutter({ chars }: Theme, { maxGutter, spans }: Frame, line: Line): string {
    if (maxGutter === 0) {
        return '';
    }
    let gutter = '';
    let arrow = false;
    for (const [index, span] of spans
        .filter((candidate) => spanDrawsInGutter(line, candidate))
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
        gutter += spanCrossesLine(line, span) ? styled(chars.vbar, span.style) : ' ';
    }

    return `${gutter}${' '.repeat((arrow ? 1 : 3) + Math.max(maxGutter - codePointsOf(gutter).length, 0))}`;
}

export function highlightGutter(
    { chars }: Theme,
    { maxGutter, spans }: Frame,
    line: Line,
    labelLayout: LabelLayout,
): string {
    if (maxGutter === 0) {
        return '';
    }
    let gutter = '';
    let columns = 0;
    for (const [index, span] of spans
        .filter((candidate) => spanDrawsInGutter(line, candidate))
        .entries()) {
        if (!spanWithinLine(line, span) && ends(line, span)) {
            const repeat = Math.max(maxGutter - index, 0) + 2;
            if (labelLayout === 'rest') {
                gutter += ' '.repeat(repeat);
            } else {
                const bar = chars.hbar.repeat(repeat - (labelLayout === 'first' ? 1 : 0));
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

function labelLine(
    { chars }: Theme,
    text: string,
    style: string,
    labelLayout: LabelLayout,
): string {
    const body = styled(text, style);
    const opening = {
        first: `${chars.lbot}${chars.hbar}${chars.rcross} ${body}`,
        rest: `  ${chars.vbar} ${body}`,
        single: `${chars.lbot}${chars.hbar}${chars.hbar} ${body}`,
    }[labelLayout];

    return styled(opening, style);
}

export function labelLines(label: string): { labelLayout: LabelLayout; text: string }[] {
    const [first = '', ...rest] = label.split('\n');

    return [
        { labelLayout: rest.length > 0 ? 'first' : 'single', text: first },
        ...rest.map((text) => ({ labelLayout: 'rest' as const, text })),
    ];
}

// Every label hangs from the middle of its underline, crossing the bars of the spans to its left.
export function singleLineMarks(
    theme: Theme,
    frame: Frame,
    line: Line,
    onLine: readonly MarkedSpan[],
): string {
    const { chars } = theme;
    let highest = 0;
    let underline = '';
    const bars: Bar[] = [];
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
        for (const { labelLayout, text: labelText } of span.label === undefined
            ? []
            : labelLines(span.label)) {
            text += frame.noLinum + highlightGutter(theme, frame, line, 'single');
            text += `${hangingLabel(theme, bars, span, { labelLayout, text: labelText })}\n`;
        }
    }

    return text;
}

function hangingLabel(
    theme: Theme,
    bars: readonly Bar[],
    span: MarkedSpan,
    { labelLayout, text }: { labelLayout: LabelLayout; text: string },
): string {
    let drawn = '';
    let column = 1;
    for (const bar of bars) {
        const padding = Math.max(bar.middle + 1 - column, 0);
        drawn += ' '.repeat(padding);
        column += padding;
        if (sameSpan(bar.span, span)) {
            return drawn + labelLine(theme, text, span.style, labelLayout);
        }
        drawn += styled(theme.chars.vbar, bar.span.style);
        column += 1;
    }

    return drawn;
}

function sameSpan(left: Label, right: Label): boolean {
    return (
        left.offset === right.offset && left.length === right.length && left.label === right.label
    );
}

export function multiLineEnd(theme: Theme, frame: Frame, line: Line, span: MarkedSpan): string {
    const { chars } = theme;
    const corner = { first: chars.rcross, rest: chars.vbar, single: chars.hbar };

    return labelLines(span.label ?? '')
        .map(
            ({ labelLayout, text }) =>
                `${frame.noLinum}${highlightGutter(theme, frame, line, labelLayout)}` +
                `${styled(corner[labelLayout], span.style)} ${styled(text, span.style)}\n`,
        )
        .join('');
}
