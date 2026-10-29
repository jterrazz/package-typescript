import { describe, expect, test } from 'vitest';

import { ciFindingsOf } from '../ci-finding.js';

const LESSON =
    'found: the file is missing · why: a long reason the terminal keeps · fix: add it · read: docs/reference/quality-checks.md#a';

describe('ci-finding', () => {
    test("ciFindingsOf — the toolchain's line read as its rule, its place and its lesson, the why left out", () => {
        // Given - a coloured report line carrying a lesson, a warning, and a line that is no lesson
        const log = [
            `\u001B[0;31m  src/a.ts:3:7: error config(project-declared): ${LESSON}\u001B[0m`,
            'b.ts:1:23: warning eslint(no-var): Unexpected var',
            '',
        ].join('\n');

        // Then - each finding, its lesson split into found, fix and read
        expect(ciFindingsOf({ log, pass: 'config', status: 1 })).toStrictEqual([
            {
                column: 7,
                fix: 'add it',
                found: 'the file is missing',
                line: 3,
                path: 'src/a.ts',
                read: 'docs/reference/quality-checks.md#a',
                rule: 'config(project-declared)',
                severity: 'error',
            },
            {
                column: 23,
                found: 'Unexpected var',
                line: 1,
                path: 'b.ts',
                rule: 'eslint(no-var)',
                severity: 'warning',
            },
        ]);
    });

    test("ciFindingsOf — the compiler's line, its code as the rule", () => {
        // Given - the compiler's report of a type error
        // Then - the TypeScript code names the rule
        expect(
            ciFindingsOf({
                log: "types.ts(1,7): error TS2322: Type 'number' is not assignable to type 'string'.\n",
                pass: 'types',
                status: 1,
            }),
        ).toStrictEqual([
            {
                column: 7,
                found: "Type 'number' is not assignable to type 'string'.",
                line: 1,
                path: 'types.ts',
                rule: 'typescript(TS2322)',
                severity: 'error',
            },
        ]);
    });

    test('ciFindingsOf — a lesson with no place, the pass as its rule', () => {
        // Given - the ratchet's lesson, printed with no place
        // Then - the ratchet's lesson is a finding of its pass
        expect(ciFindingsOf({ log: `${LESSON}\n`, pass: 'lint', status: 1 })).toStrictEqual([
            {
                fix: 'add it',
                found: 'the file is missing',
                read: 'docs/reference/quality-checks.md#a',
                rule: 'lint',
                severity: 'error',
            },
        ]);
    });

    test("ciFindingsOf — a tool's workflow command, its properties unescaped and its message's own place dropped", () => {
        // Given - oxlint's command on a runner, with a multi-line message, and one with no place
        const log = [
            '::warning file=src/a%2Cb.ts,line=11,endLine=11,col=8,endColumn=14,title=eslint(no-unused-vars)::src/a,b.ts:11:18: Variable %25 unused%0Asecond line',
            '::error::a bare one',
            '',
        ].join('\n');

        // Then - the place from the properties, the first line of the message, the pass for a missing title
        expect(ciFindingsOf({ log, pass: 'lint', status: 1 })).toStrictEqual([
            {
                column: 8,
                found: 'Variable % unused',
                line: 11,
                path: 'src/a,b.ts',
                rule: 'eslint(no-unused-vars)',
                severity: 'warning',
            },
            {
                column: undefined,
                found: 'a bare one',
                line: undefined,
                path: undefined,
                rule: 'lint',
                severity: 'error',
            },
        ]);
    });

    test("ciFindingsOf — knip's headings, each issue below one read at its place, and a line that ends the list", () => {
        // Given - knip's report, a file, an export and a type, then a line that is no issue
        const log = [
            'Unused files (1)',
            'orphan.ts',
            'Unused exports (1)',
            'unread  label.ts:2:14',
            'stale  label.ts:4',
            'Unused exported types (1)',
            'UnreadShape  type  label.ts:3:13',
            '',
            'stray.ts',
        ].join('\n');

        // Then - one finding per issue, the kind naming the rule; the stray line after the gap is none
        expect(ciFindingsOf({ log, pass: 'unused', status: 1 })).toStrictEqual([
            {
                column: undefined,
                found: 'Unused files: orphan.ts',
                line: undefined,
                path: 'orphan.ts',
                rule: 'knip(unused-files)',
                severity: 'error',
            },
            {
                column: 14,
                found: 'Unused exports: unread',
                line: 2,
                path: 'label.ts',
                rule: 'knip(unused-exports)',
                severity: 'error',
            },
            {
                column: undefined,
                found: 'Unused exports: stale',
                line: 4,
                path: 'label.ts',
                rule: 'knip(unused-exports)',
                severity: 'error',
            },
            {
                column: 13,
                found: 'Unused exported types: UnreadShape',
                line: 3,
                path: 'label.ts',
                rule: 'knip(unused-exported-types)',
                severity: 'error',
            },
        ]);
    });

    test("ciFindingsOf — knip's form read in the unused pass alone", () => {
        // Given - knip's heading and file, read in a pass other than unused
        // Then - the same lines in another pass are its first line
        expect(
            ciFindingsOf({ log: 'Unused files (1)\norphan.ts\n', pass: 'docs', status: 1 }),
        ).toStrictEqual([{ found: 'Unused files (1)', rule: 'docs', severity: 'error' }]);
    });

    test("ciFindingsOf — oxfmt's files, each a finding of the format pass alone", () => {
        // Given - oxfmt's check report
        const log =
            'Checking formatting...\n\nsrc/added.ts (3ms)\nsrc/index.ts (1.2s)\n\nFormat issues found in above 2 files.\n';

        // Then - one finding per file it would rewrite, read in the format pass only
        expect(ciFindingsOf({ log, pass: 'format', status: 1 })).toStrictEqual(
            ['src/added.ts', 'src/index.ts'].map((path) => ({
                fix: 'run `typescript fix`, which formats it',
                found: `${path} is not formatted`,
                path,
                read: 'docs/reference/quality-checks.md#the-oxfmt-pass',
                rule: 'oxfmt(format)',
                severity: 'error',
            })),
        );
        expect(ciFindingsOf({ log, pass: 'lint', status: 1 })).toStrictEqual([
            { found: 'Checking formatting...', rule: 'lint', severity: 'error' },
        ]);
    });

    test('ciFindingsOf — a failing pass whose log states no finding is one, its first line or its exit code; a passing one is none', () => {
        // Given - a failing log naming a line, a silent failing log, and a green log with chatter
        // Then - the first line, the code where the log is silent, and nothing for a green pass
        expect([
            ciFindingsOf({ log: '\nsomething broke\nmore\n', pass: 'docs', status: 1 }),
            ciFindingsOf({ log: '', pass: 'docs', status: 2 }),
            ciFindingsOf({ log: 'chatter\n', pass: 'docs', status: 0 }),
        ]).toStrictEqual([
            [{ found: 'something broke', rule: 'docs', severity: 'error' }],
            [{ found: 'the pass failed with exit code 2', rule: 'docs', severity: 'error' }],
            [],
        ]);
    });
});
