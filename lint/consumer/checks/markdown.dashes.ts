import { FENCE, linesWithFrontmatterBlanked } from './markdown.fences.js';

export type DashFinding = { column: number; line: number; message: string };

const HTML_COMMENT = /<!--.*?-->/gsu;

// invariant: a code span closes on a run of as many backticks as opened it, so a span of two can hold one.
const CODE_SPAN = /(?<ticks>`+).+?\k<ticks>/gu;

const QUOTE = /^\s*>/u;

const EM_DASH = /—/gu;

// invariant: an en dash with a character on both sides is a range (2020-2024, pages 3-5) and stays; one with a space or a line's edge beside it punctuates.
const PUNCTUATING_EN_DASH = /(?<!\S)–|–(?!\S)/gu;

const blanked = (text: string): string => text.replaceAll(/[^\n]/gu, ' ');

const FIX =
    'rewrite the sentence with a comma, a colon, a semicolon, parentheses or a full stop, as a writer does by hand';

function dashesOf(prose: string): { column: number; dash: string }[] {
    const found = [
        ...[...prose.matchAll(EM_DASH)].map((match) => ({
            dash: 'an em dash',
            index: match.index,
        })),
        ...[...prose.matchAll(PUNCTUATING_EN_DASH)].map((match) => ({
            dash: 'an en dash',
            index: match.index,
        })),
    ];

    return found
        .toSorted((left, right) => left.index - right.index)
        .map(({ dash, index }) => ({ column: index + 1, dash }));
}

/** Every em dash, and every en dash used as punctuation, in the prose of a page: code spans, fences, quotes and comments are not prose. */
export function proseDashes(markdown: string): DashFinding[] {
    const lines = linesWithFrontmatterBlanked(markdown.replaceAll(HTML_COMMENT, blanked));
    const found: DashFinding[] = [];
    let inFence = false;

    for (const [index, line] of lines.entries()) {
        if (FENCE.test(line)) {
            inFence = !inFence;
            continue;
        }
        if (inFence || QUOTE.test(line)) {
            continue;
        }
        for (const { column, dash } of dashesOf(line.replaceAll(CODE_SPAN, blanked))) {
            found.push({
                column,
                line: index + 1,
                message: `${dash} punctuates the prose at line ${index + 1}: ${FIX}`,
            });
        }
    }

    return found;
}
