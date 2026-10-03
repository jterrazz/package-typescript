import { describe, expect, test } from 'vitest';

import { suppressionDirectives } from './directives.js';

const { suppressedLines } = suppressionDirectives('checker');

describe('directives', () => {
    test('disable-next-line suppresses the next NON-BLANK line, skipping blanks/comments', () => {
        // Given - a directive with a blank line before the real statement
        const text = [
            '// checker-disable-next-line database-named-only-when-several -- reason',
            '',
            'api.seed("x.sql");',
        ].join('\n');

        // Then - line 3 (the statement), not line 2 (blank), is suppressed
        expect(suppressedLines(text, 'database-named-only-when-several')).toStrictEqual(
            new Set([3]),
        );
    });

    test("checker-disable comments — disable-next-line steps over another tool's directive to the line of code", () => {
        // Given - a checker directive above an oxlint one, both claiming the next line
        const text = [
            '// checker-disable-next-line named-path-exists -- reason',
            '// oxlint-disable-next-line jterrazz/golden-path-has-extension -- reason',
            "expect(out).toMatch(file('./_expected/help'));",
        ].join('\n');

        // Then - the statement is the suppressed line, not the second directive
        expect(suppressedLines(text, 'named-path-exists')).toStrictEqual(new Set([3]));
    });

    test('disable-line suppresses its OWN line', () => {
        // Given - a same-line directive
        const text = [
            'const a = 1;',
            'api.seed("x.sql"); // checker-disable-line database-named-only-when-several',
        ].join('\n');

        // Then - line 2 is suppressed
        expect(suppressedLines(text, 'database-named-only-when-several')).toStrictEqual(
            new Set([2]),
        );
    });

    test('a comma/space-separated id list suppresses each listed pass', () => {
        // Given - a directive naming two passes
        const text = [
            '// checker-disable-next-line database-named-only-when-several, docker-exec-bound-with-await-using -- reason',
            'code();',
        ].join('\n');

        // Then - both `database-named-only-when-several` and `docker-exec-bound-with-await-using` are suppressed on line 2
        expect(suppressedLines(text, 'database-named-only-when-several')).toStrictEqual(
            new Set([2]),
        );
        expect(suppressedLines(text, 'docker-exec-bound-with-await-using')).toStrictEqual(
            new Set([2]),
        );
        expect(suppressedLines(text, 'no-unused-ground')).toStrictEqual(new Set());
    });

    test('the wildcard `*` suppresses every pass', () => {
        // Given - a wildcard directive
        const text = ['// checker-disable-next-line * -- blanket', 'code();'].join('\n');

        // Then - any queried id is suppressed
        expect(suppressedLines(text, 'database-named-only-when-several')).toStrictEqual(
            new Set([2]),
        );
        expect(suppressedLines(text, 'no-unused-ground')).toStrictEqual(new Set([2]));
    });

    test('a directive naming a different pass does not suppress the queried one', () => {
        // Given - a directive naming `docker-exec-bound-with-await-using` alone
        const text = [
            '// checker-disable-next-line docker-exec-bound-with-await-using -- reason',
            'api.seed("x.sql");',
        ].join('\n');

        // Then - an `database-named-only-when-several` query sees nothing suppressed
        expect(suppressedLines(text, 'database-named-only-when-several')).toStrictEqual(new Set());
    });

    test('the trailing `-- reason` is stripped before matching ids (reason words are not ids)', () => {
        // Given - a reason that contains the queried id as a plain word
        const text = [
            '// checker-disable-next-line docker-exec-bound-with-await-using -- database-named-only-when-several is unrelated here',
            'code();',
        ].join('\n');

        // Then - "database-named-only-when-several" inside the reason is not treated as a targeted id
        expect(suppressedLines(text, 'database-named-only-when-several')).toStrictEqual(new Set());
        expect(suppressedLines(text, 'docker-exec-bound-with-await-using')).toStrictEqual(
            new Set([2]),
        );
    });

    test('matching is case-insensitive (the formatter capitalizes comment leads)', () => {
        // Given - a formatter-capitalized directive
        const text = [
            '// Checker-disable-next-line database-named-only-when-several -- reason',
            'code();',
        ].join('\n');

        // Then - the capitalized form still suppresses
        expect(suppressedLines(text, 'database-named-only-when-several')).toStrictEqual(
            new Set([2]),
        );
    });

    test('source with no directive suppresses nothing', () => {
        // Given - plain code
        const text = ['api.seed("x.sql");', 'api.table("t");'].join('\n');

        // Then - the suppression set is empty
        expect(suppressedLines(text, 'database-named-only-when-several')).toStrictEqual(new Set());
    });

    test('a trailing directive with no following non-blank line suppresses nothing', () => {
        // Given - a disable-next-line as the very last line
        const text = [
            'code();',
            '// checker-disable-next-line database-named-only-when-several -- dangling',
        ].join('\n');

        // Then - there is no next statement to suppress
        expect(suppressedLines(text, 'database-named-only-when-several')).toStrictEqual(new Set());
    });
});
