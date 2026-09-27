import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { forgetTree, moveKeepingHistory, treeKind, treeNames, treeStamp } from './git-tree.js';

function project(files: string[], git?: { add: string[]; ignore?: string }): string {
    const root = mkdtempSync(join(tmpdir(), 'tree-'));
    for (const path of files) {
        mkdirSync(dirname(join(root, path)), { recursive: true });
        writeFileSync(join(root, path), `${path}\n`);
    }
    if (git !== undefined) {
        if (git.ignore !== undefined) {
            writeFileSync(join(root, '.gitignore'), git.ignore);
        }
        execFileSync('git', ['init', '--quiet'], { cwd: root });
        if (git.add.length > 0) {
            execFileSync('git', ['add', ...git.add], { cwd: root });
        }
    }
    forgetTree();
    return root;
}

describe('git-tree', () => {
    test('the tree git does not ignore — lists an untracked file beside a tracked one — a new file needs no `git add`', () => {
        // Given - a repository tracking one module, and a new one nobody added
        const root = project(['src/old.ts', 'src/new.ts'], { add: ['src/old.ts'] });

        // Then - both are in the tree
        expect(treeNames(join(root, 'src')).toSorted()).toStrictEqual(['new.ts', 'old.ts']);
        expect(treeKind(join(root, 'src', 'new.ts'))).toBe('file');
    });

    test('the tree git does not ignore — leaves out what `.gitignore` names, a file or a whole folder', () => {
        // Given - a local data folder and a scratch file, both ignored
        const root = project(['src/kept.ts', 'src/scratch.log', 'data/dump.json'], {
            add: [],
            ignore: 'data/\n*.log\n',
        });

        // Then - on disk, and out of the tree
        expect(treeNames(root).toSorted()).toStrictEqual(['.gitignore', 'src']);
        expect(treeNames(join(root, 'src'))).toStrictEqual(['kept.ts']);
        expect(treeKind(join(root, 'src', 'scratch.log'))).toBeUndefined();
        expect(treeKind(join(root, 'data'))).toBeUndefined();
        expect(treeKind(join(root, 'data', 'dump.json'))).toBeUndefined();
    });

    test('the tree git does not ignore — leaves out a tracked file deleted from the disk', () => {
        // Given - two tracked modules, one of them removed without telling git
        const root = project(['src/kept.ts', 'src/gone.ts'], { add: ['src'] });
        rmSync(join(root, 'src', 'gone.ts'));

        // Then - the index still holds it, the tree does not
        expect(treeNames(join(root, 'src'))).toStrictEqual(['kept.ts']);
        expect(treeKind(join(root, 'src', 'gone.ts'))).toBeUndefined();
    });

    test('the tree git does not ignore — sees a file and a folder created after a first read, with no forget — an editor lints again', () => {
        // Given - a repository whose tree was read once
        const root = project(['src/old.ts'], { add: ['src'] });
        expect(treeNames(join(root, 'src'))).toStrictEqual(['old.ts']);

        // When - a module and a folder are written after it, and nothing drops the listing
        writeFileSync(join(root, 'src', 'new.ts'), 'new\n');
        mkdirSync(join(root, 'src', 'nested'));
        writeFileSync(join(root, 'src', 'nested', 'deep.ts'), 'deep\n');

        // Then - the next read sees them
        expect(treeNames(join(root, 'src')).toSorted()).toStrictEqual([
            'nested',
            'new.ts',
            'old.ts',
        ]);
        expect(treeKind(join(root, 'src', 'new.ts'))).toBe('file');
        expect(treeKind(join(root, 'src', 'nested'))).toBe('directory');
        expect(treeNames(join(root, 'src', 'nested'))).toStrictEqual(['deep.ts']);
    });

    test('the tree git does not ignore — reads the index again once it moved — a path `git rm --cached` and ignored leaves the tree', () => {
        // Given - a tracked data file under a folder ignored after it was added, read once
        const root = project(['data/dump.json', 'src/a.ts'], { add: ['data', 'src'] });
        writeFileSync(join(root, '.gitignore'), 'data/\n');
        expect(treeKind(join(root, 'data', 'dump.json'))).toBe('file');

        // When - git stops tracking it: only the index changes
        execFileSync('git', ['rm', '--cached', '--quiet', 'data/dump.json'], { cwd: root });

        // Then - the ignore rule now hides it
        expect(treeKind(join(root, 'data', 'dump.json'))).toBeUndefined();
    });

    test('the tree git does not ignore — reads the disk where git places the directory in no work tree', () => {
        // Given - two files and no repository
        const root = project(['src/a.ts', 'src/b.log']);

        // Then - both are read
        expect(treeNames(join(root, 'src')).toSorted()).toStrictEqual(['a.ts', 'b.log']);
        expect(treeKind(join(root, 'src', 'b.log'))).toBe('file');
    });

    test('the tree git does not ignore — reads the disk under a hand-made `.git` folder git does not recognise', () => {
        // Given - a `.git` directory holding no repository
        const root = project(['specs/rm/rm.spec.yaml']);
        mkdirSync(join(root, '.git'));

        // Then - the disk answers
        expect(treeNames(join(root, 'specs'))).toStrictEqual(['rm']);
    });

    test('the tree git does not ignore — reads the disk inside a `node_modules/` git ignores — a dependency is no project file', () => {
        // Given - a checkout ignoring node_modules, with a package installed under it
        const root = project(
            [
                'src/a.ts',
                'node_modules/@scope/pkg/package.json',
                'node_modules/@scope/pkg/dist/index.js',
            ],
            { add: ['src'], ignore: 'node_modules/\n' },
        );
        const installed = join(root, 'node_modules', '@scope', 'pkg');

        // Then - the project's walk still never enters it, and a read of the dependency sees the disk
        expect(treeNames(root).toSorted()).toStrictEqual(['.gitignore', 'src']);
        expect(treeNames(installed).toSorted()).toStrictEqual(['dist', 'package.json']);
        expect(treeKind(join(installed, 'package.json'))).toBe('file');
        expect(treeKind(join(installed, 'dist'))).toBe('directory');
    });

    test('the tree git does not ignore — throws on a directory that is not there, as the disk does', () => {
        // Given - a repository, and a path inside it that names nothing
        const root = project(['specs/rm/rm.spec.yaml'], { add: ['specs'] });

        // Then - a missing directory is not an empty one
        expect(() => treeNames(join(root, 'specs', 'gone'))).toThrow(/ENOENT/u);
    });

    test("the listing's own freshness stamp — stays the same while neither the folder nor the index changed", () => {
        // Given - a repository, its `src/` stamped once
        const root = project(['src/old.ts'], { add: ['src'] });
        const first = treeStamp(join(root, 'src'));

        // Then - asking again names the same stamp
        expect(treeStamp(join(root, 'src'))).toBe(first);
    });

    test("the listing's own freshness stamp — changes once a file is written into the folder", () => {
        // Given - a folder stamped before a sibling of its one file exists
        const root = project(['src/old.ts'], { add: ['src'] });
        const before = treeStamp(join(root, 'src'));

        // When - a new file is written there
        writeFileSync(join(root, 'src', 'new.ts'), 'new\n');

        // Then - the stamp moves — the listing itself would answer differently now
        expect(treeStamp(join(root, 'src'))).not.toBe(before);
    });

    test("the listing's own freshness stamp — changes once the index moves, the folder's own files untouched", () => {
        // Given - a tracked file, its folder stamped once
        const root = project(['src/a.ts'], { add: ['src'] });
        const before = treeStamp(join(root, 'src'));

        // When - git stops tracking it, the file itself left on disk
        execFileSync('git', ['rm', '--cached', '--quiet', 'src/a.ts'], { cwd: root });

        // Then - the stamp moves — what the tree lists there changed too
        expect(treeStamp(join(root, 'src'))).not.toBe(before);
    });

    test("the listing's own freshness stamp — is the folder alone outside any work tree", () => {
        // Given - two files and no repository
        const root = project(['src/a.ts']);
        const before = treeStamp(join(root, 'src'));

        // When - a sibling is written
        writeFileSync(join(root, 'src', 'b.ts'), 'b\n');

        // Then - the folder's own time still moves the stamp with no index to read
        expect(treeStamp(join(root, 'src'))).not.toBe(before);
    });

    test('the move that keeps history — moves a tracked file with `git mv`, so the index follows', () => {
        // Given - a tracked module
        const root = project(['src/old.ts'], { add: ['src'] });

        // When - it is moved
        moveKeepingHistory(join(root, 'src', 'old.ts'), join(root, 'src', 'new.ts'));

        // Then - the index holds the new path only
        const indexed = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' });
        expect(indexed.split('\n').filter(Boolean)).toStrictEqual(['src/new.ts']);
    });

    test('the move that keeps history — moves an untracked file by rename, and the tree reads it at its new place', () => {
        // Given - a repository, a new file nobody added, and the tree already read
        const root = project(['src/kept.ts', 'src/draft.ts'], { add: ['src/kept.ts'] });
        expect(treeNames(join(root, 'src')).toSorted()).toStrictEqual(['draft.ts', 'kept.ts']);

        // When - it is moved
        moveKeepingHistory(join(root, 'src', 'draft.ts'), join(root, 'src', 'final.ts'));

        // Then - the listing was read again
        expect(treeNames(join(root, 'src')).toSorted()).toStrictEqual(['final.ts', 'kept.ts']);
    });
});
