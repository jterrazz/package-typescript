import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, test } from 'vitest';

import { changeOf, changeSince, hunksOf, namesACommit } from './change.js';

const created: string[] = [];

afterAll(() => {
    for (const root of created) {
        rmSync(root, { force: true, recursive: true });
    }
});

function committedRepository(files: Record<string, string>): string {
    const root = mkdtempSync(join(tmpdir(), 'mutation-change-'));
    created.push(root);
    for (const [path, content] of Object.entries(files)) {
        writeFileSync(join(root, path), content);
    }
    const git = (...args: string[]): void => {
        execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], { cwd: root });
    };
    git('init', '--quiet');
    git('add', '--all');
    git('commit', '--quiet', '--message', 'first');

    return root;
}

describe('change', () => {
    test('reads the lines each hunk adds or rewrites in the new numbering, and none of a hunk that only deletes or a file the change deletes', () => {
        // Given - a diff rewriting one line and adding a block in one file, one of whose lines reads like a header, deleting lines in a second, and deleting a third file
        const diff = [
            'diff --git a/src/a.ts b/src/a.ts',
            '--- a/src/a.ts',
            '+++ b/src/a.ts',
            '@@ -4 +4 @@ export const a = 1;',
            '-old',
            '+new',
            '@@ -10,12 +11,13 @@',
            "+const header = '+++ b/elsewhere.ts @@ -1 +40 @@';",
            'diff --git a/src/b.ts b/src/b.ts',
            '--- a/src/b.ts',
            '+++ b/src/b.ts',
            '@@ -7,2 +6,0 @@',
            '-gone',
            '-gone too',
            'diff --git a/src/c.ts b/src/c.ts',
            '--- a/src/c.ts',
            '+++ /dev/null',
            '@@ -1 +0,0 @@',
            '-all',
        ].join('\n');

        // Then - the rewritten line and the added block, and nothing of the deletions
        expect(hunksOf(diff)).toStrictEqual(
            new Map([
                [
                    'src/a.ts',
                    [
                        [4, 4],
                        [11, 23],
                    ],
                ],
            ]),
        );
    });

    test('reads what the working tree changed since a commit, a file git does not track yet whole, and nothing where git names no commit or knows no repository', () => {
        // Given - a repository whose second line was rewritten since its commit, beside a file not yet added
        const root = committedRepository({ 'a.ts': 'one\ntwo\nthree\n' });
        writeFileSync(join(root, 'a.ts'), 'one\n2\nthree\n');
        writeFileSync(join(root, 'b.ts'), 'new\n');

        // Then - the line and the new file, and no answer for a commit that is not there or a folder outside any repository
        expect(changeSince(root, 'HEAD')).toStrictEqual(
            new Map<string, [number, number][] | true>([
                ['a.ts', [[2, 2]]],
                ['b.ts', true],
            ]),
        );
        expect(changeSince(root, '0000000000000000000000000000000000000000')).toBeUndefined();
        expect(changeSince(tmpdir(), 'HEAD')).toBeUndefined();
    });

    test('the suite measures the lines --mutate names, a file named alone whole, else the change since the commit asked, and says when git cannot answer', () => {
        // Given - a repository whose first line was rewritten since its commit, and a folder outside any repository
        const root = committedRepository({ 'a.ts': 'one\n' });
        writeFileSync(join(root, 'a.ts'), '1\n');

        // Then - the named files, the rewritten line, and nothing but a note naming the commit git could not find
        expect([
            changeOf(root, {
                ranges: [
                    'src/x.ts:13-14',
                    'src/x.ts:19:12-22:30',
                    'src/y.ts',
                    'src/z.ts:1-1',
                    'src/z.ts',
                    'src/w.ts',
                    'src/w.ts:5-6',
                ],
                since: 'HEAD',
            }),
            changeOf(root, { ranges: undefined, since: 'HEAD' }),
            changeOf(tmpdir(), { ranges: undefined, since: 'main' }),
        ]).toStrictEqual([
            {
                changed: new Map<string, [number, number][] | true>([
                    [
                        'src/x.ts',
                        [
                            [13, 14],
                            [19, 22],
                        ],
                    ],
                    ['src/y.ts', true],
                    ['src/z.ts', true],
                    ['src/w.ts', true],
                ]),
            },
            { changed: new Map([['a.ts', [[1, 1]]]]) },
            {
                changed: new Map(),
                note: 'git names no commit main: the whole suite measures nothing of this change.',
            },
        ]);
    });

    test('git names a commit the clone holds, and neither the zero commit a first push carries, a ref it lacks, nor anything outside a repository', () => {
        // Given - a repository of one commit, and a folder outside any repository
        const root = committedRepository({ 'a.ts': 'one\n' });

        // Then - HEAD alone is a commit
        expect([
            namesACommit(root, 'HEAD'),
            namesACommit(root, '0000000000000000000000000000000000000000'),
            namesACommit(root, 'main-that-was-force-pushed'),
            namesACommit(tmpdir(), 'HEAD'),
        ]).toStrictEqual([true, false, false, false]);
    });
});
