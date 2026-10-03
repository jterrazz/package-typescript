import { describe, expect, test } from 'vitest';

import { blankComments, commentSpansOf, quotedMask } from './comments.js';

const SOURCE_TEXT = `const a = 'x // y'; // note
/* opened
   closed */ f(\`t \${g("z")} u\`);`;

const marked = (text: string, mask: readonly boolean[]): string =>
    text.replaceAll(/[^\n]/gu, (_char: string, offset: number) =>
        mask[offset] === true ? '^' : '.',
    );

const spelled = (written: string): string => written.replaceAll('#', '$').replaceAll('~', '\u005C');

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

    test.each([
        [
            'a lone star or slash inside a block',
            '/* 2 * 3 / 4 */ x',
            '                x',
            '.................',
        ],
        [
            'a regular expression right after a block',
            '/* a *//x/.test(s)',
            '       /x/.test(s)',
            '..................',
        ],
        [
            'an escaped backtick, a dollar and braces in a template',
            'const t = `a~` $5 {b}`; // c',
            'const t = `a~` $5 {b}`;     ',
            '..........^^^^^^^^^^^^......',
        ],
        [
            'an escaped quote in a string',
            "const q = 'it~'s // here'; // c",
            "const q = 'it~'s // here';     ",
            '..........^^^^^^^^^^^^^^^......',
        ],
        [
            'braces closed before any template opened',
            '} else { f(); } // c',
            '} else { f(); }     ',
            '....................',
        ],
        [
            'an object literal inside an interpolation',
            'const n = `t #{ {a: {b: 1}}.a } u`; // c',
            'const n = `t #{ {a: {b: 1}}.a } u`;     ',
            '..........^^^.................^^^^......',
        ],
        [
            'a block closed after a template it holds',
            'if (a) { log(`v #{v}`); } // c',
            'if (a) { log(`v #{v}`); }     ',
            '.............^^^...^^.........',
        ],
        [
            'a division and a product',
            'const r = a / b * c; // c',
            'const r = a / b * c;     ',
            '.........................',
        ],
        ['a line comment touching code', 'f(x)// c', 'f(x)    ', '........'],
        [
            'a block opened by its own closing slash',
            '/*/ still */ x',
            '             x',
            '..............',
        ],
        [
            'a string left open at the end of its line',
            "const s = 'open\n// c",
            "const s = 'open\n    ",
            '..........^^^^^\n....',
        ],
        [
            'a template across two lines',
            'const t = `line one\nline two`; // c',
            'const t = `line one\nline two`;     ',
            '..........^^^^^^^^^\n^^^^^^^^^......',
        ],
    ])('reads %s', (_case, written, blank, mask) => {
        // Given - the text, each `#{` an interpolation and each `~` a backslash
        const text = spelled(written);

        // Then - the comments turn to spaces, and the strings alone are marked
        expect([blankComments(text), marked(text, quotedMask(text))]).toStrictEqual([
            spelled(blank),
            mask,
        ]);
    });

    test('spans each comment of a line from its opening to its end, and marks each offset of a string', () => {
        // Given - a block and a line comment, then a quoted letter
        // Then - each span where it sits, each offset true or false
        expect([commentSpansOf('a /* b */ c // d'), quotedMask("a'b'")]).toStrictEqual([
            [
                [
                    [2, 9],
                    [12, 16],
                ],
            ],
            [false, true, true, true, false],
        ]);
    });
});
