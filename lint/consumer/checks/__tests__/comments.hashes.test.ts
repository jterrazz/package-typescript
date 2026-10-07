import { describe, expect, test } from 'vitest';

import { commentsOfHashes } from '../comments.hashes.js';

const lines = (...text: string[]): string => text.join('\n');

const openingsOf = (text: string): string[] =>
    commentsOfHashes(text).map(({ end, opening, start }) => `${opening} @${start}-${end}`);

describe('commentsOfHashes', () => {
    test('reads each run of `#` lines once, from its first line to the end of its last', () => {
        // Given - a shebang, a run of two lines, an indented line opening wide, code between, and a `#!` past the first line
        const text = lines(
            '#!/bin/sh',
            '# one',
            '#  carried on',
            'set -eu',
            '    ##   two',
            'run',
            '#!three',
        );

        // Then - each run opens on its first line's text, its span its lines', and only the first line holds a shebang
        expect(openingsOf(text)).toStrictEqual(['one @10-29', 'two @42-50', '!three @55-62']);
    });

    test('reads a `#` on the first line as a comment when it opens no shebang', () => {
        // Given - a file opening on a comment
        // Then - it is read like any other
        expect(openingsOf(lines('# first', 'run'))).toStrictEqual(['first @0-7']);
    });

    test('reads two runs apart when a blank line stands between them', () => {
        // Given - two comments a blank line apart
        // Then - two runs
        expect(openingsOf(lines('# one', '', '# two'))).toStrictEqual(['one @0-5', 'two @7-12']);
    });

    test('reads every comment past a block scalar, whatever its indentation', () => {
        // Given - a scalar, a comment at the key's indentation, then a deeper one
        const text = lines('run: |', '    make', '# after', '    # deeper');

        // Then - one run of both, the scalar closed for good
        expect(openingsOf(text)).toStrictEqual(['after @16-36']);
    });

    test('reads a line of hashes alone as a comment with no text', () => {
        // Given - a `#` line holding nothing else
        // Then - a run whose opening is empty
        expect(openingsOf(lines('##', 'run'))).toStrictEqual([' @0-2']);
    });

    test('leaves out the lines a heredoc carries, until its delimiter closes it', () => {
        // Given - a quoted heredoc and an indented one, each carrying a `#` line, and a comment after each
        const text = lines(
            "cat <<'NOTES'",
            'text',
            '# carried',
            'NOTES',
            '# after the first',
            'cat <<-END',
            '    # carried too',
            '    END',
            '# after the second',
        );

        // Then - only the comments outside both
        expect(openingsOf(text)).toStrictEqual([
            'after the first @35-52',
            'after the second @90-108',
        ]);
    });

    test('leaves out the lines of a YAML block scalar, and reads the comments around it', () => {
        // Given - a list item's `run: |`, a folded `>-` value, each carrying a `#` line, and comments after
        const text = lines(
            'steps:',
            '    - run: |',
            '          make check',
            '',
            '          # carried',
            '    # after the script',
            'note: >-',
            '    # carried too',
            '# after the note',
        );

        // Then - the comments at the indentation the scalars closed on
        expect(openingsOf(text)).toStrictEqual([
            'after the script @66-84',
            'after the note @112-128',
        ]);
    });

    test.each([
        ['a key', 'key: |'],
        ['a key spaced wide', 'key:   >-'],
        ['a list item', '- |'],
        ['a list item spaced wide', '-   |'],
        ['a key of a list item', '- - key: |+'],
        ['an indentation indicator', 'key: |2'],
        ['a trailing comment', 'key: >  # folded'],
    ])('leaves out what the block scalar of %s carries', (_case, opener) => {
        // Given - the opener, a carried `#` line, and a comment back at the opener's indentation
        const text = lines(opener, '      # carried', '# after');

        // Then - the comment after alone
        expect(openingsOf(text)).toStrictEqual([
            `after @${String(opener.length + 17)}-${String(opener.length + 24)}`,
        ]);
    });

    test.each([
        ['a plain value opening on a bar', 'key: |x'],
        ['a bar inside a value', 'key: a | b'],
        ['a dash and a bar ending a value', 'key: a - |'],
    ])('reads the comments below %s, which opens no block scalar', (_case, line) => {
        // Given - the line, then an indented comment
        const text = lines(line, '    # read');

        // Then - the comment is read
        expect(openingsOf(text)).toStrictEqual([
            `read @${String(line.length + 5)}-${String(line.length + 11)}`,
        ]);
    });

    test('reads a comment inside a block a mapping opens, which no scalar carries', () => {
        // Given - a mapping key with no scalar indicator, and a `|` inside a value's text
        const text = lines('jobs:', '    # the job', '    name: a | b', '    # the name');

        // Then - both comments
        expect(openingsOf(text)).toStrictEqual(['the job @10-19', 'the name @40-50']);
    });
});
