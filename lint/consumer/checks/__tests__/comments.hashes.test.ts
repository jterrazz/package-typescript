import { describe, expect, test } from 'vitest';

import { commentsOfHashes } from '../comments.hashes.js';
import {
    DIALECT_READS,
    lines,
    MAKEFILES,
    PROBES,
    SCRIPT_LINES,
    YAML_LINES,
} from './comments.hashes.fixtures.js';

const openingsOf = (text: string, path = 'scripts/run.sh'): string[] =>
    commentsOfHashes(text, path).map(({ end, opening, start }) => `${opening} @${start}-${end}`);

const readOf = (text: string, path = 'scripts/run.sh'): string[] =>
    commentsOfHashes(text, path).map(({ opening }) => opening);

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
        expect(openingsOf(text, 'workflow.yaml')).toStrictEqual(['after @16-36']);
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
        expect(openingsOf(text, 'workflow.yaml')).toStrictEqual([
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
        expect(openingsOf(text, 'workflow.yaml')).toStrictEqual([
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
        expect(openingsOf(text, 'workflow.yaml')).toStrictEqual([
            `read @${String(line.length + 5)}-${String(line.length + 11)}`,
        ]);
    });

    test('reads a comment inside a block a mapping opens, which no scalar carries', () => {
        // Given - a mapping key with no scalar indicator, and a `|` inside a value's text
        const text = lines('jobs:', '    # the job', '    name: a | b', '    # the name');

        // Then - both comments
        expect(openingsOf(text, 'workflow.yaml')).toStrictEqual([
            'the job @10-19',
            'the name @40-50',
        ]);
    });

    test('leaves out the lines a quoted string of a script carries, until its quote closes', () => {
        // Given - a double-quoted string over three lines, a single-quoted one, an escaped quote, and a comment after each
        const text = lines(
            'NOTES="first line',
            '# the heading of the notes',
            '"',
            '# after the double',
            "echo 'one",
            '# carried',
            "two'",
            '# after the single',
            String.raw`echo "a \" b`,
            '# carried too',
            '"',
            '# after the escape',
        );

        // Then - only the comments outside the strings
        expect(openingsOf(text).map((run) => run.split(' @')[0])).toStrictEqual([
            'after the double',
            'after the single',
            'after the escape',
        ]);
    });

    test.each([
        ['a trailing comment', "echo hi # don't"],
        ['a quote inside the other', `echo "it's" 'say "hi"'`],
        ['a hash inside a word', "echo a#'b'"],
    ])('opens no string on %s, so the comment below is read', (_case, line) => {
        // Given - the line, then a comment
        const text = lines(line, '# read');

        // Then - the comment is read
        expect(openingsOf(text).map((run) => run.split(' @')[0])).toStrictEqual(['read']);
    });

    test("leaves out a make `define`'s body, nested ones included, and reads a recipe's quotes", () => {
        // Given - a define holding a nested define and a `#` line, then a recipe whose string spans a line
        const text = lines(
            'define SCRIPT',
            '# carried',
            'override define INNER',
            '# carried too',
            'endef',
            '# still carried',
            'endef',
            '# after the define',
            'run:',
            '\techo "one \\',
            '# carried by the quote',
            '\ttwo"',
            '# after the recipe',
            "NAME = don't",
            '# after the assignment',
        );

        // Then - only the comments outside the define and the string; an assignment quotes nothing
        expect(readOf(text, 'Makefile')).toStrictEqual([
            'after the define',
            'after the recipe',
            'after the assignment',
        ]);
    });

    test('reads every `#` line of a Dockerfile, a quote open on a RUN line or not', () => {
        // Given - a RUN line opening a quote its continuation closes, a `#` line between
        const text = lines('RUN echo "one \\', '# dropped by docker', '    two"');

        // Then - the line is a comment, as docker reads it
        expect(
            openingsOf(text, 'deploy/Dockerfile').map((run) => run.split(' @')[0]),
        ).toStrictEqual(['dropped by docker']);
    });

    test('leaves out the lines a quoted YAML scalar carries, and opens none on a plain one', () => {
        // Given - a double-quoted value over lines, a single-quoted one with a doubled quote, a plain value holding an apostrophe
        const text = lines(
            'steps:',
            '    - run: "echo one',
            '          # carried',
            '          two"',
            '    # after the double',
            "    - name: 'it''s",
            '          # carried too',
            "          done'",
            '    # after the single',
            "    - name: don't",
            '    # after the plain',
        );

        // Then - only the comments outside the quoted scalars
        expect(openingsOf(text, 'workflow.yaml').map((run) => run.split(' @')[0])).toStrictEqual([
            'after the double',
            'after the single',
            'after the plain',
        ]);
    });

    test.each(DIALECT_READS)('reads %s in its own dialect', (path, read) => {
        // Given - a probe each dialect reads apart
        // Then - the shell, recipe, define and value probes read as the dialect does
        expect(
            [PROBES.shell, PROBES.define, PROBES.recipe, PROBES.value].map((text) =>
                readOf(text, path),
            ),
        ).toStrictEqual(read);
    });

    test.each(SCRIPT_LINES)('reads a script across %s', (_case, line, read) => {
        // Given - the line, then a comment
        // Then - the comment is read only when no quote stays open
        expect(readOf(lines(line, '# x'))).toStrictEqual(read);
    });

    test.each(YAML_LINES)('reads a YAML file across %s', (_case, line, read) => {
        // Given - the line, then a comment
        // Then - the comment is read only when no quote stays open
        expect(readOf(lines(line, '# x'), 'workflow.yaml')).toStrictEqual(read);
    });

    test('keeps a YAML scalar open across its plain lines, until one closes it', () => {
        // Given - a quoted value over a plain line, a `#` line and its closing line
        const text = lines('run: "a', '  b', '  # inside', '  c"', '# after');

        // Then - the comment after alone
        expect(readOf(text, 'workflow.yaml')).toStrictEqual(['after']);
    });

    test.each(MAKEFILES)('reads a Makefile across %s', (_case, text, read) => {
        // Given - the Makefile
        // Then - the comments outside every define
        expect(readOf(text, 'Makefile')).toStrictEqual(read);
    });
});
