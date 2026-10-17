import { describe, expect, test } from 'vitest';

import { proseDashes } from '../markdown.dashes.js';

const EM = '—';
const EN = '–';

const FIX =
    'rewrite the sentence with a comma, a colon, a semicolon, parentheses or a full stop, as a writer does by hand';

const page = (...lines: readonly string[]): string => lines.join('\n');

describe('markdown.dashes', () => {
    test('names every em dash of the prose at its line and column, a heading, a list item and a table cell included', () => {
        // Given - a heading, a sentence holding two em dashes, a list item and a table row, each punctuated by one
        const markdown = page(
            `# A title ${EM} with a dash`,
            '',
            `One clause ${EM} then another ${EM} then the end.`,
            '',
            `- an item ${EM} explained`,
            `| cell | a reason ${EM} given |`,
        );

        // Then - each dash is named where it stands, with the fix
        expect(proseDashes(markdown)).toStrictEqual([
            {
                column: 11,
                line: 1,
                message: `an em dash punctuates the prose at line 1: ${FIX}`,
            },
            {
                column: 12,
                line: 3,
                message: `an em dash punctuates the prose at line 3: ${FIX}`,
            },
            {
                column: 27,
                line: 3,
                message: `an em dash punctuates the prose at line 3: ${FIX}`,
            },
            {
                column: 11,
                line: 5,
                message: `an em dash punctuates the prose at line 5: ${FIX}`,
            },
            {
                column: 19,
                line: 6,
                message: `an em dash punctuates the prose at line 6: ${FIX}`,
            },
        ]);
    });

    test('names an en dash with a space or a line edge beside it, and leaves a range between two characters', () => {
        // Given - an en dash between spaces, at each edge of a line, with a space on one side only, and two ranges
        const markdown = page(
            `A clause ${EN} and another.`,
            `It ends ${EN}`,
            `${EN}5 degrees`,
            `5${EN}`,
            `a ${EN}b`,
            `a${EN} b`,
            `From 2020${EN}2024, pages 3${EN}5.`,
        );

        // Then - every punctuating dash is named, never the ranges
        expect(proseDashes(markdown)).toStrictEqual([
            { column: 10, line: 1, message: `an en dash punctuates the prose at line 1: ${FIX}` },
            { column: 9, line: 2, message: `an en dash punctuates the prose at line 2: ${FIX}` },
            { column: 1, line: 3, message: `an en dash punctuates the prose at line 3: ${FIX}` },
            { column: 2, line: 4, message: `an en dash punctuates the prose at line 4: ${FIX}` },
            { column: 3, line: 5, message: `an en dash punctuates the prose at line 5: ${FIX}` },
            { column: 2, line: 6, message: `an en dash punctuates the prose at line 6: ${FIX}` },
        ]);
    });

    test('names the dashes of one line in the order they stand, whichever kind comes first', () => {
        // Given - an en dash, then an em dash, on one line
        const markdown = `First ${EN} then ${EM} last`;

        // Then - the en dash comes first, at its column
        expect(proseDashes(markdown)).toStrictEqual([
            { column: 7, line: 1, message: `an en dash punctuates the prose at line 1: ${FIX}` },
            { column: 14, line: 1, message: `an em dash punctuates the prose at line 1: ${FIX}` },
        ]);
    });

    test('leaves the dashes of what is not prose: a code span of any width, a fence of either kind, a quote, a comment and the frontmatter', () => {
        // Given - a dash in each place the prose gate does not read
        const markdown = page(
            '---',
            `title: A page ${EM} titled`,
            '---',
            '',
            `A span \`a ${EM} b\` and a wider one \`\`a \` ${EM} b\`\` stay.`,
            '',
            '```text',
            `printed ${EM} as is`,
            '```',
            '',
            '~~~',
            `tilde ${EN} fenced`,
            '~~~',
            '',
            `> a quote ${EM} kept`,
            `   > an indented quote ${EM} kept`,
            '',
            `<!-- a note ${EM} for the author -->`,
            '<!--',
            `a comment ${EM} over lines`,
            '-->',
        );

        // Then - nothing is named
        expect(proseDashes(markdown)).toStrictEqual([]);
    });

    test('reads the prose around a code span, after a fence closes, and a line that only holds a quote mark', () => {
        // Given - a dash beside a code span, one after a fence, and one on a line with a `>` inside it
        const markdown = page(
            `Run \`make\` ${EM} it builds.`,
            '```',
            `code ${EM}`,
            '```',
            `After ${EN} prose.`,
            `When a > b ${EM} it is no quote.`,
        );

        // Then - both are named at their columns
        expect(proseDashes(markdown)).toStrictEqual([
            { column: 12, line: 1, message: `an em dash punctuates the prose at line 1: ${FIX}` },
            { column: 7, line: 5, message: `an en dash punctuates the prose at line 5: ${FIX}` },
            { column: 12, line: 6, message: `an em dash punctuates the prose at line 6: ${FIX}` },
        ]);
    });
});
