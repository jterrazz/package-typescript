import { describe, expect, test } from 'vitest';

import { airlessFences, FENCE, linesWithFrontmatterBlanked } from '../markdown.fences.js';

const rows = (count: number, text = 'line'): string[] =>
    Array.from({ length: count }, (_, index) => `${text} ${String(index + 1)}`);

const fenced = (body: readonly string[], fence = '```'): string[] => [fence, ...body, fence];

describe('markdown.fences', () => {
    test('airlessFences — a fenced run past fifteen lines is named with its opening line, and fifteen is the limit', () => {
        // Given - a fence of fifteen lines, one of sixteen opening on line 3, and a tilde fence indented, of sixteen
        const at = (body: readonly string[], fence?: string): string[] =>
            airlessFences(['# Title', '', ...fenced(body, fence)].join('\n'));

        // Then - only the longer runs are named, each at the line its fence opens on, with the break that survives the formatter
        expect([at(rows(15)), at(rows(16)), at(rows(16), '  ~~~')]).toStrictEqual([
            [],
            [
                'a fenced block at line 3 runs 16 lines unbroken — the limit is 15; a blank line after line 11 survives the formatter',
            ],
            [
                'a fenced block at line 3 runs 16 lines unbroken — the limit is 15; a blank line after line 11 survives the formatter',
            ],
        ]);
    });

    test('airlessFences — a blank line breaks a run, prose outside a fence is no run, and each fence is counted by itself', () => {
        // Given - ten lines, a blank line holding spaces, ten lines; sixteen lines of prose; then two walls of sixteen back to back
        const broken = fenced([...rows(10), '   ', ...rows(10)]).join('\n');
        const prose = rows(16, 'prose').join('\n');
        const twice = [...fenced(rows(16)), ...fenced(rows(16))].join('\n');

        // Then - the broken fence and the prose name nothing, and the two walls are named at their own lines
        expect([airlessFences(broken), airlessFences(prose), airlessFences(twice)]).toStrictEqual([
            [],
            [],
            [
                'a fenced block at line 1 runs 16 lines unbroken — the limit is 15; a blank line after line 9 survives the formatter',
                'a fenced block at line 19 runs 16 lines unbroken — the limit is 15; a blank line after line 27 survives the formatter',
            ],
        ]);
    });

    test('airlessFences — a fence left open to the end of the page is judged too', () => {
        // Given - a fence opening on line 2 and never closed, sixteen lines long
        const page = ['intro', '```', ...rows(16)].join('\n');

        // Then - the run is named all the same
        expect(airlessFences(page)).toStrictEqual([
            'a fenced block at line 2 runs 16 lines unbroken — the limit is 15; a blank line after line 10 survives the formatter',
        ]);
    });

    test('airlessFences — the break named is the one nearest the middle that the formatter keeps: not after an opener, nor before a closer, and the earlier of two as near', () => {
        // Given - sixteen lines whose 8th opens a block, the 7th opening one and the 9th a closer, sixteen all opening one, and sixteen opening all but the last
        const opens = rows(16);
        opens[7] = 'call({';
        const both = rows(16);
        both[6] = 'call({';
        both[8] = '})';
        const all = rows(16).map((row) => `${row} {`);
        const lastOne = rows(16).map((row, index) => (index < 15 ? `${row} (` : row));
        const named = (body: readonly string[]): string[] => airlessFences(fenced(body).join('\n'));

        // Then - the 7th line when the 8th opens (7 and 9 are as near, the earlier wins), the 9th when the 7th opens and the 9th closes (so the 8th break is lost to the closer), and none when no break is left
        expect([named(opens), named(both), named(all), named(lastOne)]).toStrictEqual([
            [
                'a fenced block at line 1 runs 16 lines unbroken — the limit is 15; a blank line after line 8 survives the formatter',
            ],
            [
                'a fenced block at line 1 runs 16 lines unbroken — the limit is 15; a blank line after line 10 survives the formatter',
            ],
            ['a fenced block at line 1 runs 16 lines unbroken — the limit is 15'],
            ['a fenced block at line 1 runs 16 lines unbroken — the limit is 15'],
        ]);
    });

    test('linesWithFrontmatterBlanked — keeps every line and drops what the frontmatter says, only at the head of the page', () => {
        // Given - a page opening on frontmatter, and one carrying a rule of dashes further down
        const headed = '---\ntitle: x\n---\n# Page\n';
        const ruled = '# Page\n---\ntext\n---\n';

        // Then - the frontmatter lines are empty and counted, the rest of the page stands as written
        expect([
            linesWithFrontmatterBlanked(headed),
            linesWithFrontmatterBlanked(ruled),
        ]).toStrictEqual([
            ['', '', '', '# Page', ''],
            ['# Page', '---', 'text', '---', ''],
        ]);
    });

    test('FENCE — a fence of backticks or tildes opens a line, indented or not, and one later on a line does not', () => {
        // Given - the openings and lines that only carry the marks
        // Then - the openings match, the others do not
        expect(
            ['```', '```ts', '  ```', '~~~', '    ~~~yaml', 'text ```', '` ``', ''].map((line) =>
                FENCE.test(line),
            ),
        ).toStrictEqual([true, true, true, true, true, false, false, false]);
    });
});
