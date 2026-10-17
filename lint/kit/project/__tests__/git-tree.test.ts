import { clock } from '@jterrazz/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import {
    forgetTree,
    moveKeepingHistory,
    treeEntries,
    treeKind,
    treeNames,
    treeStamp,
} from '../git-tree.js';
import { gitAsked, project } from './git-tree.fixtures.js';

const PINNED = '2099-01-01T00:00:00Z';
const PINNED_SECONDS = Date.parse(PINNED) / 1000;

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

    test('the tree git does not ignore — sees a file and a folder created after a first read, though in its very millisecond, with no forget — an editor lints again', () => {
        // Given - a repository whose tree was read once, at a pinned instant
        const root = project(['src/old.ts'], { add: ['src'] });
        using _ = clock.at(PINNED);
        expect(treeNames(join(root, 'src'))).toStrictEqual(['old.ts']);

        // When - a module and a folder are written after it, the folder stamped with that same instant, and nothing drops the listing
        writeFileSync(join(root, 'src', 'new.ts'), 'new\n');
        mkdirSync(join(root, 'src', 'nested'));
        writeFileSync(join(root, 'src', 'nested', 'deep.ts'), 'deep\n');
        utimesSync(join(root, 'src'), PINNED_SECONDS, PINNED_SECONDS);

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

    test('the tree git does not ignore — lists a tree whose listing outgrows a pipe whole, still leaving out what `.gitignore` names', () => {
        // Given - two thousand modules, a listing past the 64 KiB a pipe holds, and an ignored log
        const modules = Array.from(
            { length: 2000 },
            (_, at) => `module-${String(at).padStart(4, '0')}-of-a-real-project.ts`,
        );
        const root = project([...modules.map((name) => `src/${name}`), 'src/debug.log'], {
            add: [],
            ignore: '*.log\n',
        });

        // Then - every module, and no log
        expect(treeNames(join(root, 'src')).toSorted()).toStrictEqual(modules);
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

    test('the tree git does not ignore — reads the disk once the index is unreadable, before a first listing or after it', () => {
        // Given - two repositories ignoring logs, one read before its index is broken
        const read = project(['src/a.ts', 'src/b.log'], { add: ['src'], ignore: '*.log\n' });
        const fresh = project(['src/a.ts', 'src/b.log'], { add: ['src'], ignore: '*.log\n' });
        expect(treeNames(join(read, 'src'))).toStrictEqual(['a.ts']);

        // When - both indexes are overwritten with garbage
        writeFileSync(join(read, '.git', 'index'), 'garbage');
        writeFileSync(join(fresh, '.git', 'index'), 'garbage');

        // Then - each answer, asked again, is the disk's, and the broken listing is dropped for the folder's place
        const answers: string[][] = [];
        const asked = gitAsked(() => {
            for (const root of [read, read, read, fresh, fresh]) {
                answers.push(treeNames(join(root, 'src')).toSorted());
            }
        });
        expect(answers).toStrictEqual(Array.from({ length: 5 }, () => ['a.ts', 'b.log']));
        expect(asked).toStrictEqual(['ls-files', 'rev-parse', 'ls-files', 'rev-parse', 'ls-files']);
    });

    test('the tree git does not ignore — names each entry with its kind, the work tree itself a directory', () => {
        // Given - a tracked file, a folder and a link
        const root = project(['src/a.ts'], { add: ['src'] });
        symlinkSync('src', join(root, 'link'));

        // Then - each kind is the disk's
        const kinds = treeEntries(root)
            .toSorted((left, right) => left.name.localeCompare(right.name))
            .map((entry) => [
                entry.name,
                entry.isFile(),
                entry.isDirectory(),
                entry.isSymbolicLink(),
            ]);
        expect(kinds).toStrictEqual([
            ['link', false, false, true],
            ['src', false, true, false],
        ]);
        expect(treeKind(root)).toBe('directory');
    });

    test('the tree git does not ignore — lists a nested repository as a folder that holds nothing of the outer tree', () => {
        // Given - a repository holding another one nobody added
        const root = project(['src/a.ts', 'sub/b.ts'], { add: ['src'] });
        execFileSync('git', ['init', '--quiet'], { cwd: join(root, 'sub') });

        // Then - the outer listing names the folder, and no child under it
        expect(treeNames(root).toSorted()).toStrictEqual(['src', 'sub']);
        expect(treeNames(join(root, 'sub'))).toStrictEqual([]);
    });

    test('the listing git is asked for — once per work tree, its folders read from it, until it is forgotten', () => {
        // Given - two repositories
        const root = project(['src/a.ts'], { add: ['src'] });
        const other = project(['other.ts'], { add: ['other.ts'] });

        // Then - a first read asks git, the next ones read its listing, another tree and a forget ask again
        expect(gitAsked(() => treeNames(root))).toStrictEqual(['rev-parse', 'ls-files']);
        expect(gitAsked(() => [treeNames(root), treeNames(join(root, 'src'))])).toStrictEqual([]);
        expect(gitAsked(() => treeNames(other))).toStrictEqual(['rev-parse', 'ls-files']);
        forgetTree();
        expect(gitAsked(() => treeNames(root))).toStrictEqual(['rev-parse', 'ls-files']);
    });

    test('the listing git is asked for — once per folder in no work tree, until it is forgotten', () => {
        // Given - files and no repository
        const root = project(['src/a.ts']);

        // Then - git is asked where the folder is once, and lists nothing
        expect(gitAsked(() => [treeNames(root), treeNames(root)])).toStrictEqual(['rev-parse']);
        forgetTree();
        expect(gitAsked(() => treeNames(root))).toStrictEqual(['rev-parse']);
    });

    test('the tree git does not ignore — reads the index again once it moved, though in the very millisecond the tree was listed — a path `git rm --cached` and ignored leaves the tree', () => {
        // Given - a tracked data file under a folder ignored after it was added, listed at a frozen instant
        const root = project(['data/dump.json', 'src/a.ts'], { add: ['data', 'src'] });
        writeFileSync(join(root, '.gitignore'), 'data/\n');
        using _ = clock.at(PINNED);
        expect(treeKind(join(root, 'data', 'dump.json'))).toBe('file');

        // When - git stops tracking it, the index stamped with that same instant
        execFileSync('git', ['rm', '--cached', '--quiet', 'data/dump.json'], { cwd: root });
        utimesSync(join(root, '.git', 'index'), PINNED_SECONDS, PINNED_SECONDS);

        // Then - the ignore rule now hides it
        expect(treeKind(join(root, 'data', 'dump.json'))).toBeUndefined();
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

        // Then - the stamp moves: the listing itself would answer differently now
        expect(treeStamp(join(root, 'src'))).not.toBe(before);
    });

    test("the listing's own freshness stamp — changes once the index moves, the folder's own files untouched", () => {
        // Given - a tracked file, its folder stamped once
        const root = project(['src/a.ts'], { add: ['src'] });
        const before = treeStamp(join(root, 'src'));

        // When - git stops tracking it, the file itself left on disk
        execFileSync('git', ['rm', '--cached', '--quiet', 'src/a.ts'], { cwd: root });

        // Then - the stamp moves: what the tree lists there changed too
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

    test('the move that keeps history — moves an untracked file by rename, and the tree reads it at its new place even where the disk stamps behind the clock', () => {
        // Given - a new file nobody added, the tree read at an instant later than any stamp the disk writes next
        const root = project(['src/kept.ts', 'src/draft.ts'], { add: ['src/kept.ts'] });
        using _ = clock.at(PINNED);
        expect(treeNames(join(root, 'src')).toSorted()).toStrictEqual(['draft.ts', 'kept.ts']);

        // When - it is moved
        moveKeepingHistory(join(root, 'src', 'draft.ts'), join(root, 'src', 'final.ts'));

        // Then - the listing was read again, though no stamp is newer than it
        expect(treeNames(join(root, 'src')).toSorted()).toStrictEqual(['final.ts', 'kept.ts']);
    });
});
