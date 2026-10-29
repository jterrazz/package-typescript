import { describe, expect, test } from 'vitest';

import {
    annotationOf,
    escapedData,
    escapedProperty,
    groupOf,
    onGitHub,
    workspacePathOf,
} from '../workflow-commands.js';

describe('workflow-commands', () => {
    test('onGitHub — a GitHub Actions job alone, which sets the variable to `true`', () => {
        // Given - the environments of a GitHub job, of a job that says false, of another CI, and of none
        // Then - only the value GitHub sets reads as a runner
        expect(
            [{ GITHUB_ACTIONS: 'true' }, { GITHUB_ACTIONS: 'false' }, { CI: 'true' }, {}].map(
                (environment) => onGitHub(environment),
            ),
        ).toStrictEqual([true, false, false, false]);
    });

    test('escapedData — `%` first, then CR and LF, every occurrence, and `:` and `,` kept', () => {
        // Given - a message holding a percent sign, CR, LF, a colon and a comma
        // Then - a message GitHub reads back whole
        expect(escapedData('100% done\r\nnext\nlast: a, b %')).toBe(
            '100%25 done%0D%0Anext%0Alast: a, b %25',
        );
    });

    test('escapedProperty — a message escape, and every `:` and `,` as well', () => {
        // Given - a property value holding colons, commas, a percent sign and a newline
        // Then - a value no separator ends
        expect(escapedProperty('a:b,c:d,e%\n')).toBe('a%3Ab%2Cc%3Ad%2Ce%25%0A');
    });

    test('annotationOf — the place, the rule as title, the message, each escaped', () => {
        // Given - a finding at a place, and one at none
        const located = annotationOf({
            column: 7,
            line: 3,
            message: 'found 50%\nthen more',
            path: 'src/a,b.ts',
            severity: 'error',
            title: 'config(rule:one)',
        });
        const unlocated = annotationOf({ message: 'a gate', severity: 'warning', title: 'drift' });

        // Then - the place leads, a missing line or column reads 1, and a place-less one is titled alone
        expect(located).toBe(
            '::error file=src/a%2Cb.ts,line=3,col=7,title=config(rule%3Aone)::found 50%25%0Athen more',
        );
        expect(unlocated).toBe('::warning title=drift::a gate');
        expect(annotationOf({ message: 'm', path: 'a.ts', severity: 'error', title: 't' })).toBe(
            '::error file=a.ts,line=1,col=1,title=t::m',
        );
    });

    test('workspacePathOf — a path from the workspace GitHub checked out, the project path where it names none or lies outside it', () => {
        // Given - a member's file, a root file, a project with no workspace, and a project outside it
        // Then - a member's file reads from the workspace root
        expect([
            workspacePathOf('src/a.ts', '/w/packages/api', '/w'),
            workspacePathOf('src/a.ts', '/w', '/w'),
            workspacePathOf('src/a.ts', '/w/packages/api', undefined),
            workspacePathOf('src/a.ts', '/elsewhere', '/w'),
        ]).toStrictEqual(['packages/api/src/a.ts', 'src/a.ts', 'src/a.ts', 'src/a.ts']);
    });

    test('groupOf — a fold titled by its line, its body read as no command until the token resumes them', () => {
        // Given - a title ending on a newline over a body ending on its own, and a bare title over a bare body
        // Then - a body ending on its newline keeps it, one without gains one
        expect(groupOf('lint  ✗ 1 error\n', '::error::raw\n', 'tok')).toBe(
            '::group::lint  ✗ 1 error%0A\n::stop-commands::tok\n::error::raw\n::tok::\n::endgroup::\n',
        );
        expect(groupOf('t', 'raw', 'tok')).toBe(
            '::group::t\n::stop-commands::tok\nraw\n::tok::\n::endgroup::\n',
        );
    });
});
