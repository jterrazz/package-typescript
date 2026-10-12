import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, onTestFinished, test } from 'vitest';

import {
    blankComments,
    commentSpansOf,
    countStrykerDirectives,
    isCommentedElsewhere,
    quotedMask,
} from '../comments.js';

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

    test('reads the comments of style sheets, scripts, Makefiles, Dockerfiles and YAML, a lockfile and code aside', () => {
        // Given - one path of every kind the pass reads, and the paths it leaves to others
        const paths = [
            'Makefile',
            'tools/GNUmakefile',
            'rules.mk',
            'deploy/Dockerfile',
            'Dockerfile.prod',
            'api.dockerfile',
            'run.sh',
            'run.bash',
            'run.zsh',
            '.github/workflows/ci.yml',
            'compose.yaml',
            'theme.css',
            'theme.scss',
            'page.astro',
            'Card.svelte',
            'Card.vue',
            'pnpm-lock.yaml',
            'index.ts',
            'notes.md',
            'theMakefile',
            'Makefile.orig',
            'theme.css.map',
        ];

        // Then - the commented files, and nothing else
        expect(paths.filter((path) => isCommentedElsewhere(path))).toStrictEqual(
            paths.slice(0, 16),
        );
    });

    test('countStrykerDirectives — counts the directives of the source files the project holds, those left out by its ignore patterns and those of other files not', () => {
        // Given - two directives in a source, one in a folder the project ignores, one in a markdown page, and a source nobody can read
        const root = mkdtempSync(join(tmpdir(), 'stryker-directives-'));
        onTestFinished(() => {
            rmSync(root, { force: true, recursive: true });
        });
        const files: Record<string, string> = {
            'notes/page.md': '// Stryker disable next-line all: prose\n',
            'quoted/b.ts': '// Stryker disable next-line all: quoted upstream\n',
            'src/a.ts':
                "// Stryker disable next-line all: one\nconst a = 1; // Stryker disable next-line all: two\nconst b = 'Stryker disable next-line all: in a string'; // plain\n",
        };
        for (const [path, text] of Object.entries(files)) {
            mkdirSync(dirname(join(root, path)), { recursive: true });
            writeFileSync(join(root, path), text);
        }
        writeFileSync(
            join(root, 'src/locked.ts'),
            '// Stryker disable next-line all: unreadable\n',
        );
        chmodSync(join(root, 'src/locked.ts'), 0o000);

        // Then - all but the page, and all but the ignored folder once it is named
        expect([
            countStrykerDirectives(root),
            countStrykerDirectives(root, ['quoted/**']),
        ]).toStrictEqual([3, 2]);
    });
});
