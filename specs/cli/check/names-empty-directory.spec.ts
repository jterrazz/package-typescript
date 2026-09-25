import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripVTControlCharacters } from 'node:util';
import { describe, expect, test } from 'vitest';

import { onlyPasses, SELECTING_BIN } from '../check-passes.js';
import { temporaryDirectory } from '../temporary-directory.js';

/*
 * A chain, for the ground's sake: git tracks no directory, so a fixture can
 * carry no empty one, and what git ignores needs a repository around it.
 */

const SIX_TARGETS = [
    '.PHONY: install build lint fix test check',
    'install build lint fix test:',
    '\ttrue',
    'check: lint test',
    '',
].join('\n');

/** The empty directories a working copy is left with, and one of each kind nothing may touch. */
const EMPTY = ['src/abandoned', 'src/scaffold/domain/entities'];
const KEPT = [
    '.artifacts/tsc',
    '.next/cache',
    '.turbo/cache',
    '.vite/deps',
    'coverage/tmp',
    'dist/types',
    'local/draft',
    'node_modules/stale',
    'vendor/.git',
];

/** An empty directory only an `--ignore-pattern` glob keeps, and the glob. */
const OVERLOOKED = 'drafts/wip';
const OVERLOOKING = ['--ignore-pattern', 'drafts/**'];

/** A green repository carrying every kind of empty directory, and the kinds that are not one. */
function repositoryWithEmptyDirectories(): string {
    const project = temporaryDirectory('spec-names-empty-');
    writeFileSync(
        join(project, 'package.json'),
        `${JSON.stringify({ main: 'src/index.ts', name: 'spec-names-empty', private: true, version: '1.0.0' }, null, 2)}\n`,
    );
    writeFileSync(
        join(project, 'tsconfig.json'),
        '{ "compilerOptions": { "strict": true, "noEmit": true, "skipLibCheck": true }, "include": ["src/**/*.ts"] }\n',
    );
    writeFileSync(join(project, 'Makefile'), SIX_TARGETS);
    writeFileSync(join(project, '.gitignore'), 'local/\nnode_modules/\n');
    mkdirSync(join(project, 'src/scaffold'), { recursive: true });
    writeFileSync(join(project, 'src/index.ts'), 'export const ready = true;\n');
    execFileSync('git', ['init', '--quiet'], { cwd: project });
    execFileSync('git', ['add', '.'], { cwd: project });
    for (const directory of [...EMPTY, ...KEPT]) {
        mkdirSync(join(project, directory), { recursive: true });
    }

    return project;
}

/** What the Names (tree) pass, run alone, printed between its header and its verdict, and the verdict. */
function namesPassOf(
    project: string,
    command: 'check' | 'fix',
    options: readonly string[] = [],
): string[] {
    const { stdout } = spawnSync('bash', [SELECTING_BIN, command, ...options], {
        cwd: project,
        encoding: 'utf8',
        env: { ...process.env, ...onlyPasses('names'), INIT_CWD: project },
    });
    const plain = stripVTControlCharacters(stdout);
    const pass = plain.slice(plain.indexOf('Names (tree)'));

    /* The pass closes at the next header — the next pass's, or the run's end. */
    return pass
        .slice(0, pass.search(/ (?:RUN|END) /u))
        .split('\n')
        .slice(1)
        .map((line) => line.trim())
        .filter((line) => line !== '');
}

describe('names-empty-directory', () => {
    test('names each empty directory git does not ignore, once at its top, in four parts', () => {
        // Given - a repository holding an empty folder, a folder of empty folders, and empty folders git ignores or never reads
        const project = repositoryWithEmptyDirectories();

        // When - the quality checks run
        const names = namesPassOf(project, 'check');

        // Then - the two empty trees are named at their top, each as a lesson, and nothing else is
        expect(names).toStrictEqual([
            'names-directory-empty  src/abandoned/  found: `src/abandoned/` holds no file · why: git tracks no directory, so an empty one exists only on this machine and names a part of the tree that is not there · fix: delete it — `typescript fix` does — or put the file it was made for in it · read: docs/06-quality-checks.md#an-empty-directory',
            'names-directory-empty  src/scaffold/  found: `src/scaffold/` holds no file · why: git tracks no directory, so an empty one exists only on this machine and names a part of the tree that is not there · fix: delete it — `typescript fix` does — or put the file it was made for in it · read: docs/06-quality-checks.md#an-empty-directory',
            '✗ Failed with exit code 1',
        ]);
    });

    test('deletes each empty directory git does not ignore, and leaves the rest where it stands', () => {
        // Given - the same repository
        const project = repositoryWithEmptyDirectories();

        // When - the quality fixes run
        const names = namesPassOf(project, 'fix');

        // Then - the pass says what it removed and passes, the two empty trees are gone, and the ignored and unread folders stay
        expect(names).toStrictEqual([
            'removed  src/abandoned/  an empty directory',
            'removed  src/scaffold/  an empty directory',
            '✓ Passed',
        ]);
        expect(EMPTY.map((directory) => existsSync(join(project, directory)))).toStrictEqual([
            false,
            false,
        ]);
        expect(existsSync(join(project, 'src'))).toBe(true);
        expect(KEPT.filter((directory) => !existsSync(join(project, directory)))).toStrictEqual([]);
    });

    test('names no empty directory an --ignore-pattern glob names', () => {
        // Given - the same repository, with an empty folder under drafts/, which git does not ignore
        const project = repositoryWithEmptyDirectories();
        mkdirSync(join(project, OVERLOOKED), { recursive: true });

        // When - the quality checks run with a glob naming drafts/
        const names = namesPassOf(project, 'check', OVERLOOKING);

        // Then - the two empty trees are named, and drafts/ is not
        expect(names.filter((line) => line.includes('drafts'))).toStrictEqual([]);
        expect(names.map((line) => line.split('  ')[1] ?? line)).toStrictEqual([
            'src/abandoned/',
            'src/scaffold/',
            '✗ Failed with exit code 1',
        ]);
    });

    test('removes no empty directory an --ignore-pattern glob names', () => {
        // Given - the same repository, with an empty folder under drafts/, which git does not ignore
        const project = repositoryWithEmptyDirectories();
        mkdirSync(join(project, OVERLOOKED), { recursive: true });

        // When - the quality fixes run with a glob naming drafts/
        const names = namesPassOf(project, 'fix', OVERLOOKING);

        // Then - the two empty trees are removed, and drafts/wip stands
        expect(names).toStrictEqual([
            'removed  src/abandoned/  an empty directory',
            'removed  src/scaffold/  an empty directory',
            '✓ Passed',
        ]);
        expect(existsSync(join(project, OVERLOOKED))).toBe(true);
    });
});
