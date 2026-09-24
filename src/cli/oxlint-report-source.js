/**
 * What of a source file a framed diagnostic shows: the span a label names,
 * read with one line of context above and one below, cut into lines.
 *
 * The reading is oxlint's, byte for byte, because the frame is the reader's
 * only clue to where a finding sits: offsets are UTF-8 byte offsets, CR, LF
 * and CRLF each end a line while the cut into lines splits on LF alone, and a
 * span ending on a line break reaches the line after it.
 */

const CR = 0x0d;
const LF = 0x0a;

/** Every line break of a source — `start` is its first byte, `end` its last. */
function breaksOf(data) {
    const breaks = [];
    for (let index = 0; index < data.length; index += 1) {
        const byte = data[index];
        if (byte === LF && index > 0 && data[index - 1] === CR) {
            continue;
        }
        if (byte === CR || byte === LF) {
            const end = byte === CR && data[index + 1] === LF ? index + 1 : index;
            breaks.push({ end, start: index });
        }
    }

    return breaks;
}

/** A source file, read once for every label that points into it. */
export function sourceOf(data) {
    return { breaks: breaksOf(data), data };
}

/** How many of the breaks start before `end`. */
function breaksBefore(breaks, end) {
    let low = 0;
    let high = breaks.length;
    while (low < high) {
        const middle = Math.floor((low + high) / 2);
        if ((breaks[middle]?.start ?? 0) < end) {
            low = middle + 1;
        } else {
            high = middle;
        }
    }

    return low;
}

/** The byte a scan starts from, and the lines behind it: one of context kept. */
function prefixOf({ breaks, data }, offset) {
    let end = Math.min(Math.max(offset - 1, 0), data.length);
    if (end > 0 && data[end - 1] === CR) {
        end -= 1;
    }
    const lineCount = breaksBefore(breaks, end);
    const last = breaks[lineCount - 1];
    const previous = breaks[lineCount - 2];

    return {
        currentLineStart: last === undefined ? 0 : last.end + 1,
        end,
        leadingStart: lineCount === 0 ? null : previous === undefined ? 0 : previous.end + 1,
        lineCount,
        startLine: Math.max(lineCount - 1, 0),
    };
}

/**
 * One line break met while scanning a span: a break above the span moves the
 * one line of leading context down, and a break past the span's end, once the
 * span is reached, counts toward the one line of trailing context. True once
 * that line is read.
 */
function meetBreak(state, end, span) {
    state.lineCount += 1;
    if (end < span.offset) {
        if (state.leadingStart !== null) {
            state.startLine += 1;
        }
        state.leadingStart = state.lineStart;
    } else if (end >= span.breakThreshold && state.active) {
        state.trailing += state.sawNewline ? 1 : 0;
        state.sawNewline = true;
        if (state.trailing >= 1) {
            state.position = end + 1;

            return true;
        }
    }
    state.lineStart = end + 1;
    state.position = end;

    return false;
}

/** Scan from the byte before the span to the end of the line after it. */
function scan(data, state, span) {
    while (state.position < data.length) {
        const byte = data[state.position];
        if (byte === CR || byte === LF) {
            const end =
                byte === CR && data[state.position + 1] === LF
                    ? state.position + 1
                    : state.position;
            if (meetBreak(state, end, span)) {
                return;
            }
        }
        if (state.position >= span.endThreshold) {
            state.active = true;
            if (state.trailing >= 1) {
                state.position += 1;

                return;
            }
        }
        state.position += 1;
    }
}

/**
 * The bytes a label's frame shows — from the line above it to the line below
 * it — with the 0-based number of its first line and the count of line
 * breaks read to reach its end. Null when the span runs past the source.
 */
export function readSpan(source, offset, length) {
    const { data } = source;
    const prefix = prefixOf(source, offset);
    const span = {
        breakThreshold: offset + Math.max(length - 1, 0),
        endThreshold: Math.max(offset + length - 1, 0),
        offset,
    };
    const state = {
        active: false,
        leadingStart: prefix.leadingStart,
        lineCount: prefix.lineCount,
        lineStart: prefix.currentLineStart,
        position: prefix.end,
        sawNewline: false,
        startLine: prefix.startLine,
        trailing: 0,
    };
    scan(data, state, span);

    const start = state.leadingStart ?? 0;
    if (
        state.position < span.endThreshold ||
        start > state.position ||
        state.position > data.length
    ) {
        return null;
    }

    return {
        data: data.subarray(start, state.position),
        line: state.startLine,
        lineCount: state.lineCount,
        start,
    };
}

/**
 * The 1-based line and byte column of an offset, the way oxlint places a
 * diagnostic on its one-line forms. Null past the end of the file.
 */
export function positionAt({ breaks, data }, offset) {
    if (offset > data.length) {
        return null;
    }
    const at =
        offset > 0 && offset < data.length && data[offset - 1] === CR && data[offset] === LF
            ? offset - 1
            : offset;
    const before = breaksBefore(breaks, at);
    const last = breaks[before - 1];

    return { column: at - (last === undefined ? 0 : last.end + 1) + 1, line: before + 1 };
}

/** The 0-based line and byte column of an offset inside a frame's bytes. */
export function lineColumnAt(contents, offset) {
    const { data } = contents;
    let relative = Math.max(offset - contents.start, 0);
    if (relative > data.length) {
        return null;
    }
    if (
        relative > 0 &&
        relative < data.length &&
        data[relative - 1] === CR &&
        data[relative] === LF
    ) {
        relative -= 1;
    }
    const breaks = breaksOf(data.subarray(0, relative));
    const last = breaks.at(-1);

    return last === undefined
        ? { column: relative, line: contents.line }
        : { column: relative - (last.end + 1), line: contents.line + breaks.length };
}

/** A frame's bytes as numbered lines — each with its byte offset, byte length and text. */
export function linesOf(contents) {
    const { data, start: base } = contents;
    const lines = [];
    let number = contents.line;
    let start = 0;
    const push = (end, textEnd) => {
        const bytes = data.subarray(start, textEnd);
        lines.push({
            bytes,
            length: end - start,
            number,
            offset: base + start,
            text: bytes.toString('utf8'),
        });
    };
    for (let index = 0; index < data.length; index += 1) {
        if (data[index] !== LF) {
            continue;
        }
        number += 1;
        push(index + 1, index > start && data[index - 1] === CR ? index - 1 : index);
        start = index + 1;
    }
    if (start < data.length) {
        if (data.at(-1) !== CR) {
            number += 1;
        }
        push(data.length, data.length);
    }

    return lines;
}
