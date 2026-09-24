import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { expect, onTestFinished, test } from 'vitest';

import { projectFiles } from './project-files.js';

/** A repository whose index tracks every path given, each file holding one line of source. */
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
