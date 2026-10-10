import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, test } from 'vitest';

import { changeOf, changeSince, defaultBaseOf, hunksOf, namesACommit } from '../change.js';

const created: string[] = [];

afterAll(() => {
    for (const root of created) {
        rmSync(root, { force: true, recursive: true });
    }
});

const gitIn = (root: string, ...args: string[]): string =>
    execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], {
        cwd: root,
        encoding: 'utf8',
    }).trim();

function committedRepository(files: Record<string, string>): string {
    const root = mkdtempSync(join(tmpdir(), 'mutation-change-'));
    created.push(root);
    for (const [path, content] of Object.entries(files)) {
        writeFileSync(join(root, path), content);
    }
    const git = (...args: string[]): void => {
        execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], { cwd: root });
    };
    git('init', '--quiet', '--initial-branch=main');
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

    test('the suite measures the lines --mutate names, a file named alone whole, else the change since the base, which it names, and says when git cannot answer or nothing changed', () => {
        // Given - a repository whose first line was rewritten since its commit, a clean one, and a folder outside any repository
        const root = committedRepository({ 'a.ts': 'one\n' });
        writeFileSync(join(root, 'a.ts'), '1\n');
        const clean = committedRepository({ 'a.ts': 'one\n' });
        const head = { commit: 'HEAD', names: 'the base', range: 'HEAD..working tree' };

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
                since: head,
            }),
            changeOf(root, { ranges: undefined, since: head }),
            changeOf(clean, { ranges: undefined, since: head }),
            changeOf(tmpdir(), {
                ranges: undefined,
                since: { commit: 'main', names: 'main', range: 'main..working tree' },
            }),
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
            {
                changed: new Map([['a.ts', [[1, 1]]]]),
                note: 'The change: the working tree against the base.',
            },
            {
                changed: new Map(),
                note: 'The working tree equals the base: no line changed, so the whole suite measures no change — name the commit the work started from with --since to measure one.',
            },
            {
                changed: new Map(),
                note: 'git names no commit main: the whole suite measures nothing of this change.',
            },
        ]);
    });

    test('with no commit named, a run measures the change not yet committed, else the last commit, and the first commit alone', () => {
        // Given - a repository of two commits with an edit not yet committed, the same left clean, and a repository of one commit
        const dirty = committedRepository({ 'a.ts': 'one\n' });
        writeFileSync(join(dirty, 'a.ts'), 'two\n');
        gitIn(dirty, 'commit', '--quiet', '--all', '--message', 'second');
        writeFileSync(join(dirty, 'a.ts'), 'three\n');
        const clean = committedRepository({ 'a.ts': 'one\n' });
        const first = gitIn(clean, 'rev-parse', 'HEAD');
        writeFileSync(join(clean, 'a.ts'), 'two\n');
        gitIn(clean, 'commit', '--quiet', '--all', '--message', 'second');
        const only = committedRepository({ 'a.ts': 'one\n' });

        // Then - HEAD for the edit, the commit before HEAD for the clean tree, HEAD for the lone commit
        expect([dirty, clean, only].map((root) => defaultBaseOf(root))).toStrictEqual([
            {
                commit: 'HEAD',
                names: 'HEAD — the change not yet committed',
                range: 'HEAD..working tree',
            },
            {
                commit: first,
                names: `the commit before HEAD (${first.slice(0, 8)}) — the working tree is clean, so the last commit is the change`,
                range: `${first.slice(0, 8)}..HEAD`,
            },
            {
                commit: 'HEAD',
                names: 'HEAD — the first commit, with no commit before it',
                range: 'HEAD..HEAD',
            },
        ]);
    });

    test.each([
        ['main', ['main']],
        ['master', ['master']],
        ['trunk', ['trunk', 'origin-head']],
    ])(
        'on a clean branch of its own, a run measures every commit since the merge-base with %s, not the last one alone',
        (name, [branch, remote]) => {
            // Given - a repository whose default branch is named, a branch cut from it with a docs commit last, and a clean tree
            const root = committedRepository({ 'a.ts': 'one\n' });
            gitIn(root, 'branch', '--move', branch ?? 'main');
            if (remote !== undefined) {
                gitIn(
                    root,
                    'symbolic-ref',
                    'refs/remotes/origin/HEAD',
                    `refs/remotes/origin/${name}`,
                );
            }
            const base = gitIn(root, 'rev-parse', 'HEAD');
            gitIn(root, 'switch', '--quiet', '--create', 'work');
            writeFileSync(join(root, 'a.ts'), 'two\n');
            gitIn(root, 'commit', '--quiet', '--all', '--message', 'source');
            writeFileSync(join(root, 'README.md'), 'docs\n');
            gitIn(root, 'add', '--all');
            gitIn(root, 'commit', '--quiet', '--message', 'docs');

            // Then - the branch is measured since where it left the default branch, and the verdict names that range
            expect(defaultBaseOf(root)).toStrictEqual({
                commit: base,
                names: `the merge-base with ${name} (${base.slice(0, 8)}) — the working tree is clean, so the branch's own commits are the change`,
                range: `${base.slice(0, 8)}..HEAD`,
            });
        },
    );

    test('a branch with no commit of its own, and a clone with no default branch, measure the last commit', () => {
        // Given - a branch cut from main and left there, and a clone whose only branch has another name
        const fresh = committedRepository({ 'a.ts': 'one\n' });
        writeFileSync(join(fresh, 'a.ts'), 'two\n');
        gitIn(fresh, 'commit', '--quiet', '--all', '--message', 'second');
        gitIn(fresh, 'switch', '--quiet', '--create', 'work');
        const nameless = committedRepository({ 'a.ts': 'one\n' });
        gitIn(nameless, 'branch', '--move', 'develop');
        writeFileSync(join(nameless, 'a.ts'), 'two\n');
        gitIn(nameless, 'commit', '--quiet', '--all', '--message', 'second');

        // Then - both name the commit before HEAD
        expect(
            [fresh, nameless].map((root) => defaultBaseOf(root).names.slice(0, 22)),
        ).toStrictEqual(['the commit before HEAD', 'the commit before HEAD']);
    });

    test('a branch sharing no history with the default branch has no merge-base to measure from, and reads as the commits it holds', () => {
        // Given - a repository whose main holds a commit, and an orphan branch holding one of its own, the working tree clean
        const root = committedRepository({ 'a.ts': 'one\n' });
        gitIn(root, 'switch', '--quiet', '--orphan', 'unrelated');
        writeFileSync(join(root, 'b.ts'), 'two\n');
        gitIn(root, 'add', '--all');
        gitIn(root, 'commit', '--quiet', '--message', 'unrelated');

        // Then - no merge-base: the branch's lone commit is the first, measured against HEAD alone
        expect(defaultBaseOf(root)).toStrictEqual({
            commit: 'HEAD',
            names: 'HEAD — the first commit, with no commit before it',
            range: 'HEAD..HEAD',
        });
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
