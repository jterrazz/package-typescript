/**
 * The source frames of one framed diagnostic: every label read off its file,
 * labels close enough to share lines merged into one frame, and each frame
 * drawn — `[file:line:col]`, the numbered lines with their gutter, the marks
 * under them, and the closing corner.
 */

import {
    applies,
    appliesGutter,
    ends,
    highlightGutter,
    lineGutter,
    lineOnly,
    multiLineEnd,
    singleLineMarks,
    starts,
} from './oxlint-report-marks.js';
import { lineColumnAt, linesOf, readSpan } from './oxlint-report-source.js';
import { charWidths, codePointsOf, styled } from './oxlint-report-theme.js';

/** A source line as oxlint prints it: every tab widened to the next multiple of four. */
function lineText(text) {
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

/** The widest gutter any line of a frame needs: the multi-line spans it carries at once. */
function widestGutter(lines, spans) {
    return Math.max(
        0,
        ...lines.map(
            (line) =>
                spans.filter((span) => !lineOnly(line, span) && appliesGutter(line, span)).length,
        ),
    );
}

/** One source line of a frame, then the marks drawn under it. */
function drawLine(theme, frame, line) {
    const { styles, chars } = theme;
    const number = styled(String(line.number).padStart(frame.linumWidth), styles.linum);
    let text = ` ${number} ${chars.vbar} ${lineGutter(theme, frame, line)}${lineText(line.text)}\n`;
    const touching = frame.spans.filter((span) => applies(line, span));
    const onLine = touching.filter((span) => lineOnly(line, span));
    if (onLine.length > 0) {
        text += frame.noLinum + highlightGutter(theme, frame, line, 'single');
        text += singleLineMarks(theme, frame, line, onLine);
    }
    for (const span of touching.filter((candidate) => !lineOnly(line, candidate))) {
        if (span.label !== undefined && ends(line, span) && !starts(line, span)) {
            text += multiLineEnd(theme, frame, line, span);
        }
    }

    return text;
}

/** One frame: the lines `contents` holds, marked with every label of the diagnostic. */
function drawFrame(theme, { context, contents, labels, filename }) {
    const { chars, styles } = theme;
    const lines = linesOf(contents);
    const primary = labels.find(
        (label) =>
            label.offset >= context.offset &&
            label.offset + label.length <= context.offset + context.length,
    );
    const spans = labels.map((label, index) => ({
        ...label,
        style: styles.highlights[index % 3] ?? '',
    }));
    const linumWidth = String(lines.at(-1)?.number ?? 0).length;
    const frame = {
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
    text += `[${styled(filename, styles.link)}:${at.line + 1}:${at.column + 1}]\n`;
    for (const line of lines) {
        text += drawLine(theme, frame, line);
    }

    return `${text}${' '.repeat(linumWidth + 2)}${chars.lbot}${chars.hbar.repeat(4)}\n`;
}

/** The frames of a diagnostic's labels, sorted by offset: a label reaching the lines of the last frame joins it. */
function framesOf(source, labels) {
    const frames = [];
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
            const context = {
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

/**
 * Every frame of a diagnostic, drawn — nothing for one with no label or no
 * source, and null when a label points outside its source.
 */
export function drawFrames(theme, diagnostic, source) {
    const labels = (diagnostic.labels ?? []).map(({ label, span }) => ({
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
