import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, onTestFinished, test } from 'vitest';

import { filesUnder, projectFiles, readText, trackedFiles } from '../project-files.js';

function folderHolding(paths: readonly string[]): string {
    const root = mkdtempSync(join(tmpdir(), 'project-files-'));
    onTestFinished(() => {
        rmSync(root, { force: true, recursive: true });
    });
    for (const path of paths) {
        mkdirSync(join(root, dirname(path)), { recursive: true });
        writeFileSync(join(root, path), 'export const value = 1;\n');
    }

    return root;
}

function refusalOf(root: string): undefined | { message: string; name: string } {
    try {
        projectFiles(root);
    } catch (error) {
        return error instanceof Error ? { message: error.message, name: error.name } : undefined;
    }

    return undefined;
}

function repositoryTracking(paths: readonly string[]): string {
    const root = folderHolding(paths);
    execFileSync('git', ['init', '--quiet'], { cwd: root });
    execFileSync('git', ['add', '--force', '.'], { cwd: root });

    return root;
}

describe('projectFiles', () => {
    test('drops a tracked file under a build folder, at the root or deeper', () => {
        // Given - a repository whose index tracks a tool's output folder beside its source
        const root = repositoryTracking([
            '.artifacts/tsc/index.js',
            '.next/server/page.js',
            '.turbo/cache/log.js',
            '.vite/deps/chunk.js',
            'apps/web/.next/server/page.js',
            'coverage/lcov-report/index.js',
            'dist/index.js',
            'src/index.ts',
        ]);

        // Then - the sweep hands every gate the source alone
        expect(projectFiles(root)).toStrictEqual(['src/index.ts']);
    });

    test('reads what git does not ignore, an untracked file included, a file deleted from the disk left out', () => {
        // Given - a tracked file, one deleted since, an untracked one and an ignored one
        const root = repositoryTracking(['src/z.ts', 'src/gone.ts', '.gitignore']);
        writeFileSync(join(root, '.gitignore'), '*.log\n');
        writeFileSync(join(root, 'src/a.ts'), 'a\n');
        writeFileSync(join(root, 'debug.log'), 'log\n');
        rmSync(join(root, 'src/gone.ts'));

        // Then - git's tree, sorted
        expect(projectFiles(root)).toStrictEqual(['.gitignore', 'src/a.ts', 'src/z.ts']);
    });

    test('walks the disk outside a work tree, past the build folders, links and ground left out', () => {
        // Given - a folder git knows nothing of
        const root = folderHolding([
            'src/b.ts',
            'src/a.ts',
            'dist/out.js',
            'node_modules/x/index.js',
        ]);
        symlinkSync('a.ts', join(root, 'src/link.ts'));

        // Then - the files alone, sorted
        expect(projectFiles(root)).toStrictEqual(['src/a.ts', 'src/b.ts']);
    });

    test('leaves out the ground of a specs tree or a tests folder at any depth, and what the project ignores by pattern', () => {
        // Given - ground under specs/ at two depths and in a tests folder, ground outside both — a specs folder below it included — a file merely named like ground, and a folder ignored by pattern
        const root = repositoryTracking([
            '__fixtures__/top.ts',
            'apps/api/specs/__seeds__/rows.sql',
            'specs/__fixtures__/x.ts',
            'specs/__seeds__',
            'specs/a/__expected__/y.txt',
            'src/__fixtures__/specs/rows.json',
            'src/__fixtures__/stray.json',
            'src/__seeds__',
            'src/a/__tests__/__fixtures__/z.json',
            'src/kept.ts',
            'vendor/lib.ts',
        ]);

        // Then - what the scenarios own is theirs, ground anywhere else is swept like any folder, and the pattern holds
        expect(projectFiles(root, { ignorePatterns: ['vendor/**'] })).toStrictEqual([
            '__fixtures__/top.ts',
            'specs/__seeds__',
            'src/__fixtures__/specs/rows.json',
            'src/__fixtures__/stray.json',
            'src/__seeds__',
            'src/kept.ts',
        ]);
    });

    test('refuses a tree that holds something yet sweeps nothing, and passes an empty one', () => {
        // Given - a repository ignoring every file, a folder holding only an empty folder, and an empty folder
        const ignored = repositoryTracking([]);
        writeFileSync(join(ignored, '.gitignore'), '*\n');
        const hollow = folderHolding([]);
        mkdirSync(join(hollow, 'empty'));
        const empty = folderHolding([]);

        // Then - each refusal names why, and an empty tree has nothing to say
        expect([refusalOf(ignored), refusalOf(hollow), projectFiles(empty)]).toStrictEqual([
            {
                message: `found: nothing to read under ${ignored}: git ignores every file it holds · why: a sweep that reads nothing would turn every gate above it green · fix: take the project's files out of .gitignore, then run again · read: docs/reference/quality-checks.md#an-unreadable-tree`,
                name: 'EmptySweepError',
            },
            {
                message: `found: nothing to read under ${hollow}: it holds folders and no file · why: a sweep that reads nothing would turn every gate above it green · fix: add the project's files, then run again · read: docs/reference/quality-checks.md#an-unreadable-tree`,
                name: 'EmptySweepError',
            },
            [],
        ]);
    });

    test('lists every file at any depth, relative and sorted, and no directory', () => {
        // Given - a tree with a nested file, a file at the top and an empty folder
        const root = mkdtempSync(join(tmpdir(), 'files-under-'));
        mkdirSync(join(root, 'nested/empty'), { recursive: true });
        writeFileSync(join(root, 'nested/b.txt'), 'b');
        writeFileSync(join(root, 'a.txt'), 'a');

        // Then - the two files, from the root
        expect(filesUnder(root)).toStrictEqual(['a.txt', 'nested/b.txt']);
    });

    test('lists nothing under a folder that does not exist', () => {
        // Given - a path nothing was written at
        const missing = join(tmpdir(), 'files-under-missing', 'nowhere');

        // Then - no file, and no throw
        expect(filesUnder(missing)).toStrictEqual([]);
    });

    test('readText — reads a text file, and nothing of a binary name, a link, a file past a million bytes or one holding NUL', () => {
        // Given - one file of each kind
        const root = folderHolding([]);
        writeFileSync(join(root, 'kept.ts'), 'kept\n');
        writeFileSync(join(root, 'logo.png'), 'not really an image\n');
        symlinkSync('kept.ts', join(root, 'link.ts'));
        writeFileSync(join(root, 'edge.txt'), 'x'.repeat(1_000_000));
        writeFileSync(join(root, 'large.txt'), 'x'.repeat(1_000_001));
        writeFileSync(join(root, 'nul.txt'), 'a\0b');

        // Then - the text alone, a file of exactly a million bytes still read
        const read = [
            'kept.ts',
            'logo.png',
            'link.ts',
            'edge.txt',
            'large.txt',
            'nul.txt',
            'gone.ts',
        ].map((path) => {
            const text = readText(root, path);

            return text === null ? null : text.length;
        });
        expect(read).toStrictEqual([5, null, null, 1_000_000, null, null, null]);
    });

    test("trackedFiles — is the repository's index, file by file, and nothing outside a repository", () => {
        // Given - a repository tracking two files, and a folder git knows nothing of
        const tracked = repositoryTracking(['src/b.ts', 'a.ts']);
        const plain = folderHolding(['a.ts']);

        // Then - the index's paths whole, and none for the folder
        expect([trackedFiles(tracked), trackedFiles(plain)]).toStrictEqual([
            ['a.ts', 'src/b.ts'],
            [],
        ]);
    });
});
