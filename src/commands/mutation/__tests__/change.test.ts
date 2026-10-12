import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, test } from 'vitest';

import {
    baseFor,
    changeOf,
    changeSince,
    defaultBaseOf,
    hunksOf,
    namesACommit,
    treeChangeFor,
    unmeasuredBy,
} from '../change.js';

const baseNamed = (commit: string) => ({ commit, names: commit, range: commit });

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

    test('reads a file moved by its content, so a pure move brings no line and a move with an edit only the edited line', () => {
        // Given - a repository that does not detect renames of its own, a file committed, then moved to another folder and moved again with one line rewritten
        const lines = Array.from({ length: 12 }, (_, at) => `line ${String(at)}\n`).join('');
        const root = committedRepository({ 'a.ts': lines });
        gitIn(root, 'config', 'diff.renames', 'false');
        const first = gitIn(root, 'rev-parse', 'HEAD');
        mkdirSync(join(root, 'moved'));
        gitIn(root, 'mv', 'a.ts', 'moved/a.ts');
        gitIn(root, 'commit', '--quiet', '--message', 'move');
        const moved = gitIn(root, 'rev-parse', 'HEAD');
        const pure = changeSince(root, first);
        writeFileSync(join(root, 'moved/a.ts'), lines.replace('line 3\n', 'changed\n'));

        // Then - the pure move holds no changed line, and the edit after it only its own
        expect(pure).toStrictEqual(new Map());
        expect(changeSince(root, first)).toStrictEqual(
            new Map<string, [number, number][] | true>([['moved/a.ts', [[4, 4]]]]),
        );
        expect(changeSince(root, moved)).toStrictEqual(
            new Map<string, [number, number][] | true>([['moved/a.ts', [[4, 4]]]]),
        );
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

    test('unmeasuredBy — a base that stops short of the merge-base with the default branch names the commits it leaves out, and any base reaching it names none', () => {
        // Given - a branch cut from main holding two commits of its own, an edit not yet committed, and a repository with no commit beyond its default branch
        const root = committedRepository({ 'a.ts': 'one\n' });
        const before = gitIn(root, 'rev-parse', 'HEAD');
        gitIn(root, 'switch', '--quiet', '--create', 'work');
        writeFileSync(join(root, 'a.ts'), 'two\n');
        gitIn(root, 'commit', '--quiet', '--all', '--message', 'second');
        const middle = gitIn(root, 'rev-parse', 'HEAD');
        writeFileSync(join(root, 'a.ts'), 'three\n');
        gitIn(root, 'commit', '--quiet', '--all', '--message', 'third');
        const alone = committedRepository({ 'a.ts': 'one\n' });

        // Then - the uncommitted change and a newer commit leave the branch's commits out; the merge-base, an older commit and a branch with none of its own leave nothing
        expect([
            unmeasuredBy(root, baseNamed('HEAD')),
            unmeasuredBy(root, baseNamed(middle)),
            unmeasuredBy(root, baseNamed(before)),
            unmeasuredBy(root, baseNamed('main')),
            unmeasuredBy(alone, baseNamed('HEAD')),
        ]).toStrictEqual([
            `${before.slice(0, 8)}..HEAD`,
            `${before.slice(0, 8)}..${middle}`,
            undefined,
            undefined,
            undefined,
        ]);
    });

    test('baseFor — the commit named or the default of the clone, with the branch commits it leaves out, and none outside a branch', () => {
        // Given - a branch holding two commits of its own beside main, the tree clean, and a repository of one commit
        const root = committedRepository({ 'a.ts': 'one\n' });
        const trunk = gitIn(root, 'rev-parse', 'HEAD');
        gitIn(root, 'switch', '--quiet', '--create', 'work');
        writeFileSync(join(root, 'a.ts'), 'two\n');
        gitIn(root, 'commit', '--quiet', '--all', '--message', 'second');
        const middle = gitIn(root, 'rev-parse', 'HEAD');
        writeFileSync(join(root, 'a.ts'), 'three\n');
        gitIn(root, 'commit', '--quiet', '--all', '--message', 'third');
        const alone = committedRepository({ 'a.ts': 'one\n' });

        // Then - the default reaches the merge-base and leaves nothing out; a newer commit named leaves the first commit of the branch out; nothing is left out of a repository with no branch
        expect(baseFor(root, undefined)).toMatchObject({ commit: trunk, unmeasured: undefined });
        expect(baseFor(root, middle)).toStrictEqual({
            commit: middle,
            names: middle,
            range: `${middle}..working tree`,
            unmeasured: `${trunk.slice(0, 8)}..${middle}`,
        });
        expect(baseFor(alone, undefined)).toMatchObject({ commit: 'HEAD', unmeasured: undefined });
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

    test('treeChangeFor — a static mutant is reached by the tree’s own change, whatever --mutate names, and by the stated change when it names nothing', () => {
        // Given - a repository whose working tree rewrote line 2 of a.ts, a change that names a whole file, and a base git does not know
        const root = committedRepository({ 'a.ts': 'one\ntwo\n', 'b.ts': 'x\n' });
        writeFileSync(join(root, 'a.ts'), 'one\nTWO\n');
        const named = new Map<string, true>([['b.ts', true]]);
        const head = { commit: 'HEAD', names: 'HEAD', range: 'HEAD..working tree' };
        const unknown = { commit: 'no-such-commit', names: 'it', range: 'it..working tree' };

        // Then - the tree's rewrite replaces what is named; the stated change stands when nothing is named; an unknown base reaches nothing
        expect([
            treeChangeFor(root, { ranges: ['b.ts'], since: head }, named),
            treeChangeFor(root, { ranges: undefined, since: head }, named),
            treeChangeFor(root, { ranges: ['b.ts'], since: unknown }, named),
        ]).toStrictEqual([new Map([['a.ts', [[2, 2]]]]), named, new Map()]);
    });
});
