import type { Diagnostic } from './diagnostic.js';
import {
    ends,
    highlightGutter,
    lineGutter,
    multiLineEnd,
    singleLineMarks,
    spanDrawsInGutter,
    spanTouchesLine,
    spanWithinLine,
    starts,
} from './marks.js';
import type { Frame, Label, MarkedSpan } from './marks.js';
import { lineColumnAt, linesOf, readSpan } from './source.js';
import type { Contents, Line, Source } from './source.js';
import { charWidths, codePointsOf, styled } from './theme.js';
import type { Theme } from './theme.js';

type Framed = { context: Label; contents: Contents };

// As oxlint prints it: every tab widened to the next multiple of four.
function lineText(text: string): string {
    if (!text.includes('\t')) {
        return text;
    }
    const widths = charWidths(text);

    return codePointsOf(text)
        .map((character, index) =>
            character === '\t' ? ' '.repeat(widths[index] ?? 0) : character,
        )
        .join('');
}

function widestGutter(lines: readonly Line[], spans: readonly MarkedSpan[]): number {
    return Math.max(
        0,
        ...lines.map(
            (line) =>
                spans.filter((span) => !spanWithinLine(line, span) && spanDrawsInGutter(line, span))
                    .length,
        ),
    );
}

function drawLine(theme: Theme, frame: Frame, line: Line): string {
    const { styles, chars } = theme;
    const number = styled(String(line.number).padStart(frame.linumWidth), styles.linum);
    let text = ` ${number} ${chars.vbar} ${lineGutter(theme, frame, line)}${lineText(line.text)}\n`;
    const touching = frame.spans.filter((span) => spanTouchesLine(line, span));
    const onLine = touching.filter((span) => spanWithinLine(line, span));
    if (onLine.length > 0) {
        text += frame.noLinum + highlightGutter(theme, frame, line, 'single');
        text += singleLineMarks(theme, frame, line, onLine);
    }
    for (const span of touching.filter((candidate) => !spanWithinLine(line, candidate))) {
        if (span.label !== undefined && ends(line, span) && !starts(line, span)) {
            text += multiLineEnd(theme, frame, line, span);
        }
    }

    return text;
}

function drawFrame(
    theme: Theme,
    {
        context,
        contents,
        labels,
        filename,
    }: Framed & { filename: string; labels: readonly Label[] },
): null | string {
    const { chars, styles } = theme;
    const lines = linesOf(contents);
    const primary = labels.find(
        (label) =>
            label.offset >= context.offset &&
            label.offset + label.length <= context.offset + context.length,
    );
    const spans: MarkedSpan[] = labels.map((label, index) => ({
        ...label,
        style: styles.highlights[index % 3] ?? '',
    }));
    const linumWidth = String(lines.at(-1)?.number ?? 0).length;
    const frame: Frame = {
        linumWidth,
        maxGutter: widestGutter(lines, spans),
        noLinum: `${' '.repeat(linumWidth + 2)}${chars.vbarBreak} `,
        spans,
    };
    const at =
        primary === undefined
            ? { column: 0, line: contents.line }
            : lineColumnAt(contents, primary.offset);
    if (at === null) {
        return null;
    }

    let text = `${' '.repeat(linumWidth + 2)}${chars.ltop}${chars.hbar}`;
    text += `[${styled(filename, styles.link)}:${String(at.line + 1)}:${String(at.column + 1)}]\n`;
    for (const line of lines) {
        text += drawLine(theme, frame, line);
    }

    return `${text}${' '.repeat(linumWidth + 2)}${chars.lbot}${chars.hbar.repeat(4)}\n`;
}

// A label reaching the lines of the last frame joins it.
function framesOf(source: Source, labels: readonly Label[]): Framed[] | null {
    const frames: Framed[] = [];
    for (const right of labels) {
        const contents = readSpan(source, right.offset, right.length);
        if (contents === null) {
            return null;
        }
        const left = frames.at(-1);
        if (left !== undefined && left.contents.line + left.contents.lineCount >= contents.line) {
            const end = Math.max(
                left.context.offset + left.context.length,
                right.offset + right.length,
            );
            const context: Label = {
                label: left.context.label,
                length: end - left.context.offset,
                offset: left.context.offset,
            };
            const merged = readSpan(source, context.offset, context.length);
            if (merged !== null) {
                frames[frames.length - 1] = { context, contents: merged };
                continue;
            }
        }
        frames.push({ context: right, contents });
    }

    return frames;
}

// Null when a label points outside its source.
export function drawFrames(
    theme: Theme,
    diagnostic: Diagnostic,
    source: null | Source,
): null | string {
    const labels: Label[] = (diagnostic.labels ?? []).map(({ label, span }) => ({
        label,
        length: span.length,
        offset: span.offset,
    }));
    if (source === null || labels.length === 0) {
        return '';
    }
    const sorted =
        labels.length === 1 ? labels : labels.toSorted((left, right) => left.offset - right.offset);
    const frames = framesOf(source, sorted);
    if (frames === null) {
        return null;
    }
    let text = '';
    for (const { context, contents } of frames) {
        const drawn = drawFrame(theme, {
            context,
            contents,
            filename: diagnostic.filename ?? '',
            labels: sorted,
        });
        if (drawn === null) {
            return null;
        }
        text += drawn;
    }

    return text;
}
