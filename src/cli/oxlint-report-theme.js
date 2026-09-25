// A captured log is never a terminal, so oxlint draws one of two themes: ASCII with no colour, or
// Unicode in 24-bit colour where `CI` or `FORCE_COLOR` asks.

const RESET = '\u001B[0m';

const ASCII = Object.freeze({
    advice: '>',
    error: 'x',
    hbar: '-',
    lbot: '`',
    lcross: '|',
    ltop: ',',
    rarrow: '>',
    rcross: '|',
    uarrow: '^',
    underbar: '|',
    underline: '^',
    vbar: '|',
    vbarBreak: ':',
    warning: '!',
});

const UNICODE = Object.freeze({
    advice: '☞',
    error: '×',
    hbar: '─',
    lbot: '╰',
    lcross: '├',
    ltop: '╭',
    rarrow: '▶',
    rcross: '┤',
    uarrow: '▲',
    underbar: '┬',
    underline: '─',
    vbar: '│',
    vbarBreak: '·',
    warning: '⚠',
});

const PLAIN_STYLES = Object.freeze({
    advice: '',
    error: '',
    help: '',
    highlights: ['', '', ''],
    link: '',
    linum: '',
    note: '',
    warning: '',
});

const RGB_STYLES = Object.freeze({
    advice: '\u001B[38;2;106;159;181m',
    error: '\u001B[38;2;225;80;80;1m',
    help: '\u001B[38;2;106;159;181m',
    highlights: ['\u001B[38;2;246;87;248m', '\u001B[38;2;30;201;212m', '\u001B[38;2;145;246;111m'],
    link: '\u001B[38;2;92;157;255;1m',
    linum: '\u001B[2m',
    note: '\u001B[38;2;106;159;181m',
    warning: '\u001B[38;2;244;191;117;1m',
});

export function themeOf(coloured) {
    return coloured
        ? { chars: UNICODE, styles: RGB_STYLES }
        : { chars: ASCII, styles: PLAIN_STYLES };
}

export function codePointsOf(text) {
    return text.match(/[\s\S]/gu) ?? [];
}

export function styled(text, style) {
    return style === '' ? text : `${style}${text}${RESET}`;
}

// East Asian wide and fullwidth blocks, and the emoji blocks drawn two columns wide.
const WIDE = [
    [0x11_00, 0x11_5f],
    [0x2e_80, 0x30_3e],
    [0x30_41, 0x33_ff],
    [0x34_00, 0x4d_bf],
    [0x4e_00, 0x9f_ff],
    [0xa0_00, 0xa4_cf],
    [0xac_00, 0xd7_a3],
    [0xf9_00, 0xfa_ff],
    [0xfe_30, 0xfe_4f],
    [0xff_00, 0xff_60],
    [0xff_e0, 0xff_e6],
    [0x1_f3_00, 0x1_f6_4f],
    [0x1_f9_00, 0x1_f9_ff],
    [0x2_00_00, 0x2_ff_fd],
    [0x3_00_00, 0x3_ff_fd],
];

const ZERO_WIDTH = /^[\p{Mn}\p{Me}\u200B-\u200F\u2060\uFEFF]$/u;

function codePointWidth(character) {
    const code = character.codePointAt(0) ?? 0;
    if (ZERO_WIDTH.test(character)) {
        return 0;
    }

    return WIDE.some(([low, high]) => code >= low && code <= high) ? 2 : 1;
}

const SEGMENTER = new Intl.Segmenter('en', { granularity: 'grapheme' });

const PICTOGRAPH = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;

// An emoji sequence is one wide glyph.
function graphemeWidth(grapheme) {
    if (
        grapheme.includes('\uFE0F') ||
        (codePointsOf(grapheme).length > 1 && PICTOGRAPH.test(grapheme))
    ) {
        return 2;
    }

    return codePointsOf(grapheme).reduce((sum, character) => sum + codePointWidth(character), 0);
}

function graphemesOf(text) {
    const graphemes = [];
    let index = 0;
    for (const { segment } of SEGMENTER.segment(text)) {
        graphemes.push({ start: index, width: graphemeWidth(segment) });
        index += codePointsOf(segment).length;
    }

    return graphemes;
}

// As oxlint counts: a tab or an escape leaves the grapheme it sits on uncounted, and every code
// point after it on that line counts zero.
export function charWidths(text) {
    // oxlint-disable-next-line no-control-regex -- the ASCII range is the test
    const graphemes = /^[\u0000-\u007F]*$/u.test(text) ? null : graphemesOf(text);
    let next = 0;
    let column = 0;
    let escaped = false;

    return codePointsOf(text).map((character, position) => {
        let width = 0;
        if (escaped) {
            escaped = character !== 'm';
        } else if (character === '\t') {
            width = 4 - (column % 4);
        } else if (character === '\u001B') {
            escaped = true;
        } else if (graphemes === null) {
            width = 1;
        } else if (graphemes[next]?.start === position) {
            width = graphemes[next]?.width ?? 0;
            next += 1;
        }
        column += width;

        return width;
    });
}

export function textWidth(text) {
    return charWidths(text).reduce((sum, width) => sum + width, 0);
}
