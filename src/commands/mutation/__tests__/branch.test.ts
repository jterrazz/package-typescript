import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, test } from 'vitest';

import { branchBaseFor, pathsChangedSince } from '../branch.js';

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
    const root = mkdtempSync(join(tmpdir(), 'mutation-branch-'));
    created.push(root);
    for (const [path, content] of Object.entries(files)) {
        writeFileSync(join(root, path), content);
    }
    gitIn(root, 'init', '--quiet', '--initial-branch=main');
    gitIn(root, 'add', '--all');
    gitIn(root, 'commit', '--quiet', '--message', 'first');

    return root;
}

describe('branch', () => {
    test('branchBaseFor — the merge-base with the default branch whatever the tree holds uncommitted, the commit before HEAD on the default branch, HEAD alone on a first commit, and none outside a repository', () => {
        // Given - a dirty branch cut from main after one commit of its own, main itself two commits deep, a lone commit, and a folder with no repository
        const branched = committedRepository({ 'a.ts': 'one\n' });
        const fork = gitIn(branched, 'rev-parse', 'HEAD');
        gitIn(branched, 'switch', '--quiet', '--create', 'work');
        writeFileSync(join(branched, 'a.ts'), 'two\n');
        gitIn(branched, 'commit', '--quiet', '--all', '--message', 'second');
        writeFileSync(join(branched, 'a.ts'), 'three\n');
        const main = committedRepository({ 'a.ts': 'one\n' });
        const before = gitIn(main, 'rev-parse', 'HEAD');
        writeFileSync(join(main, 'a.ts'), 'two\n');
        gitIn(main, 'commit', '--quiet', '--all', '--message', 'second');
        const only = committedRepository({ 'a.ts': 'one\n' });
        const nowhere = mkdtempSync(join(tmpdir(), 'mutation-branch-'));
        created.push(nowhere);

        // Then - the fork, the commit before HEAD, HEAD, and nothing
        expect([branched, main, only, nowhere].map((root) => branchBaseFor(root))).toStrictEqual([
            fork,
            before,
            gitIn(only, 'rev-parse', 'HEAD'),
            undefined,
        ]);
    });

    test('pathsChangedSince — names each path the tree changed since a commit, one deleted, both sides of a rename and one git does not track yet, and none where git names no commit', () => {
        // Given - a repository whose tree since its commit edits one file, deletes one, renames one and adds one untracked, in a folder with a space
        const root = committedRepository({
            'edited.ts': 'one\n',
            'gone.ts': 'one\n',
            'moved.ts': 'kept\n',
        });
        writeFileSync(join(root, 'edited.ts'), 'two\n');
        gitIn(root, 'rm', '--quiet', 'gone.ts');
        gitIn(root, 'mv', 'moved.ts', 'renamed.ts');
        mkdirSync(join(root, 'a folder'));
        writeFileSync(join(root, 'a folder/new.ts'), 'new\n');

        // Then - every path, sorted, and nothing for a commit git cannot name
        expect([
            pathsChangedSince(root, 'HEAD')?.toSorted(),
            pathsChangedSince(root, 'no-such-commit'),
        ]).toStrictEqual([
            ['a folder/new.ts', 'edited.ts', 'gone.ts', 'moved.ts', 'renamed.ts'],
            undefined,
        ]);
    });
});
