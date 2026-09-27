import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, onTestFinished, test } from 'vitest';

import { filesUnder, projectFiles } from './project-files.js';

function repositoryTracking(paths: readonly string[]): string {
    const root = mkdtempSync(join(tmpdir(), 'project-files-'));
    onTestFinished(() => {
        rmSync(root, { force: true, recursive: true });
    });
    for (const path of paths) {
        mkdirSync(join(root, dirname(path)), { recursive: true });
        writeFileSync(join(root, path), 'export const value = 1;\n');
    }
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
});
