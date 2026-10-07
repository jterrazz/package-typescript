import { describe, expect, test } from 'vitest';

import { commentsOfStyles } from '../comments.styles.js';

const lines = (...text: string[]): string => text.join('\n');

const openingsOf = (text: string, path: string): string[] =>
    commentsOfStyles(text, path).map(
        ({ end, opening, start }) => `${opening.trim()} @${start}-${end}`,
    );

describe('commentsOfStyles', () => {
    test('reads the blocks of a style sheet, never a comment written inside a string or a url', () => {
        // Given - a doc-style block, comment markers in two strings and a url, and an unclosed block
        const text = lines(
            '/** a ramp */',
            String.raw`a { content: 'a /* no */'; b: "x\" /* no */"; c: url(//cdn/a.svg); }`,
            '/* left open',
        );

        // Then - each block, from its opening to its close or the end of the sheet
        expect(openingsOf(text, 'theme.css')).toStrictEqual([
            'a ramp */ @0-13',
            'left open @83-95',
        ]);
    });

    test('reads no comment inside a string left open, which ends with its line', () => {
        // Given - a double-quoted and a single-quoted string left open, each holding a comment marker, then a block
        const text = lines('a { b: "/* no', "c: '/* no", '/* yes */');

        // Then - the block alone
        expect(openingsOf(text, 'theme.css')).toStrictEqual(['yes */ @24-33']);
    });

    test('reads a `//` line of a Sass sheet, a run of them once, and none of a plain one', () => {
        // Given - two `//` lines in a row, a string and urls holding `//`, then a third line and a doc block
        const text = lines(
            '// one',
            '  // carried on',
            'a { b: "//"; c: url(//cdn/a.svg); d: url(x//y); }',
            '/// two',
            '/*** invariant: three */',
        );

        // Then - Sass reads two runs and the block, CSS the block alone
        expect([openingsOf(text, 'theme.scss'), openingsOf(text, 'theme.css')]).toStrictEqual([
            ['one @0-22', 'two @73-80', 'invariant: three */ @81-105'],
            ['invariant: three */ @81-105'],
        ]);
    });

    test('reads no `//` inside a url left open, which runs to the end of the sheet', () => {
        // Given - a Sass sheet whose url never closes, a `//` after it
        // Then - no comment
        expect(openingsOf(lines('a { b: url(//cdn', '// c'), 'theme.scss')).toStrictEqual([]);
    });

    test('reads a `//` run apart from a block between, and a trailing line carried on below', () => {
        // Given - a line, a block, a line, a line trailing code and one below it
        const text = lines('// one', '/* two */', '// three', 'a {} // four', '// five');

        // Then - each its own run, the trailing line carried on by the one below, as in code
        expect(openingsOf(text, 'theme.scss')).toStrictEqual([
            'one @0-6',
            'two */ @7-16',
            'three @17-25',
            'four @31-46',
        ]);
    });

    test("reads each `<style>` of a component at the file's offsets, Sass by its lang", () => {
        // Given - a page with markup, a plain style, a Sass style and an unquoted Sass style
        const text = lines(
            '<p>/* text, not style */</p>',
            '<style>',
            '  /* plain */',
            '</style>',
            '<style lang="scss">',
            '  // sass',
            '  // carried on',
            '</style>',
            '<style lang=scss>',
            '  // bare',
            '</style>',
        );

        // Then - the comments of the three blocks only, where they sit in the file
        expect(openingsOf(text, 'page.astro')).toStrictEqual([
            'plain */ @39-50',
            'sass @82-105',
            'bare @135-142',
        ]);
    });
});
