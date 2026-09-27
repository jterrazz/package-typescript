import { describe, expect, test } from 'vitest';

import { blankComments, quotedMask } from './comments.js';

const SOURCE_TEXT = `const a = 'x // y'; // note
/* opened
   closed */ f(\`t \${g("z")} u\`);`;

const marked = (text: string, mask: readonly boolean[]): string =>
    text.replaceAll(/[^\n]/gu, (_char: string, offset: number) =>
        mask[offset] === true ? '^' : '.',
    );

describe('comments', () => {
    test('blanks every comment and keeps each offset, the strings untouched', () => {
        // Given - a line comment, a block across two lines, and comment markers inside a string
        // When - the comments are blanked
        const blanked = blankComments(SOURCE_TEXT);

        // Then - only the comments turned to spaces, every line at its length
        expect(blanked.split('\n')).toStrictEqual([
            "const a = 'x // y';        ",
            '         ',
            `             f(\`t \${g("z")} u\`);`,
        ]);
    });

    test("marks the strings and a template's text, never the code it interpolates", () => {
        // Given - a quoted string, a template holding an expression holding a string
        // When - the quoted offsets are marked
        const mask = marked(SOURCE_TEXT, quotedMask(SOURCE_TEXT));

        // Then - the template's expression is code again, its own string quoted
        expect(mask.split('\n')).toStrictEqual([
            '..........^^^^^^^^.........',
            '.........',
            '...............^^^....^^^.^^^^..',
        ]);
    });
});
