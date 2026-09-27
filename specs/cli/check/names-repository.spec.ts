import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripVTControlCharacters } from 'node:util';
import { describe, expect, test } from 'vitest';

import { onlyPasses, passOf, SELECTING_BIN } from '../_setup/check-passes.js';
import { temporaryDirectory } from '../_setup/temporary-directory.js';

const SIX_TARGETS = [
    '.PHONY: install build lint fix test check',
    '',
    'install:',
    '\tnpm ci',
    '',
    'build:',
    '\tnpm run build',
    '',
    'lint:',
    '\tnpm run lint',
    '',
    'fix:',
    '\tnpm run lint:fix',
    '',
    'test:',
    '\tnpm test',
    '',
    'check: lint test',
    '',
].join('\n');

function projectWith({
    isRepository = true,
    makefile,
}: {
    isRepository?: boolean;
    makefile?: string;
}): string {
    const project = temporaryDirectory('spec-names-repository-');
    writeFileSync(
        join(project, 'package.json'),
        `${JSON.stringify(
            { main: 'index.ts', name: 'spec-names-repository', private: true, version: '1.0.0' },
            null,
            2,
        )}\n`,
    );
    writeFileSync(
        join(project, 'tsconfig.json'),
        '{ "compilerOptions": { "strict": true, "noEmit": true, "skipLibCheck": true }, "include": ["**/*.ts"] }\n',
    );
    writeFileSync(
        join(project, 'index.ts'),
        'export function run(): string {\n  return "ran";\n}\n',
    );
    if (makefile !== undefined) {
        writeFileSync(join(project, 'Makefile'), makefile);
    }
    if (isRepository) {
        execFileSync('git', ['init', '--quiet'], { cwd: project });
        execFileSync('git', ['add', '.'], { cwd: project });
    }

    return project;
}

function namesPassOf(project: string): string {
    const result = spawnSync('node', [SELECTING_BIN, 'check'], {
        cwd: project,
        encoding: 'utf8',
        env: inProject(project, onlyPasses('names')),
    });

    return passOf(result.stdout, 'Names (tree)');
}

// npm's INIT_CWD names the project the CLI answers for; a chain started under npm must name its own.
function inProject(project: string, env: Record<string, string> = {}): NodeJS.ProcessEnv {
    return { ...process.env, ...env, INIT_CWD: project };
}

// git refuses to track a nested `.git`, so a fixture cannot be a repository.

const FOUR_TARGETS = [
    '.PHONY: install build lint test',
    'LINT := npm run lint',
    'CHECKED ::= no',
    '',
    'install build:',
    '\tnpm ci',
    '',
    'lint:',
    '\t$(LINT)',
    '',
    'test::',
    '\tnpm test',
    '',
    '# fix: a comment is not a rule',
    '',
].join('\n');

function treeVerdictsOf(stdout: string): string[] {
    return ['Oxlint Check', 'Markdown (prose)', 'Names (tree)', 'Secrets (credentials)'].map(
        (label) => (passOf(stdout, label).includes('✓ Passed') ? 'Passed' : 'Failed'),
    );
}

function writeDataFolder(project: string): void {
    mkdirSync(join(project, 'data'));
    // Spelled in two halves, so this file carries no key of its own.
    const key = ['AKIA', 'Q7RJ4KDNPZ2WX6TB'].join('');
    writeFileSync(
        join(project, 'data/NOTES.md'),
        `# Scratch\n\nSee [the plan](./missing.md) and the key ${key}.\n`,
    );
    writeFileSync(
        join(project, 'data/scratch.ts'),
        'export function stop(): void {\n    debugger;\n}\n',
    );
}

function checkAndRecord(project: string): { baseline: string; stdout: string } {
    const result = spawnSync('node', [SELECTING_BIN, 'check'], {
        cwd: project,
        encoding: 'utf8',
        env: inProject(project, onlyPasses('oxlint', 'markdown', 'names', 'secrets')),
    });
    execFileSync('node', [SELECTING_BIN, 'baseline'], {
        cwd: project,
        encoding: 'utf8',
        env: inProject(project),
    });

    return {
        baseline: readFileSync(join(project, 'jterrazz.baseline.json'), 'utf8'),
        stdout: result.stdout,
    };
}

function saidBy(stdout: string, label: string): string[] {
    return stripVTControlCharacters(passOf(stdout, label))
        .split('\n')
        .slice(1, -1)
        .filter(
            (line) => line.trim() !== '' && !line.includes(' RUN ') && !line.includes('Failed'),
        );
}

describe('names-repository', () => {
    test('judges an untracked folder git does not ignore in every tree gate, the linter included', () => {
        // Given - a green repository, and a data/ folder nobody has added and nothing ignores
        const project = projectWith({ makefile: SIX_TARGETS });
        writeDataFolder(project);

        // When - the quality checks run, and the baseline is recorded
        const { baseline, stdout } = checkAndRecord(project);

        // Then - every gate reads the folder: each fails, naming what it holds, and the baseline records the linter's finding and the root
        expect(treeVerdictsOf(stdout)).toStrictEqual(['Failed', 'Failed', 'Failed', 'Failed']);
        expect(passOf(stdout, 'Markdown (prose)')).toContain('data/NOTES.md');
        expect(passOf(stdout, 'Names (tree)')).toContain('data/');
        expect(passOf(stdout, 'Secrets (credentials)')).toContain('data/NOTES.md');
        expect(JSON.parse(baseline)).toMatchObject({
            typescript: { 'eslint/no-debugger': 1, 'names/no-undeclared-root-folder': 1 },
        });
    });

    test('judges no folder git ignores, in any tree gate, the linter included', () => {
        // Given - the same repository and data/ folder, the folder named in .gitignore
        const project = projectWith({ makefile: SIX_TARGETS });
        writeDataFolder(project);
        writeFileSync(join(project, '.gitignore'), 'data/\n');

        // When - the quality checks run, and the baseline is recorded
        const { baseline, stdout } = checkAndRecord(project);

        // Then - no gate reads the ignored folder: each pass is green, and the baseline records nothing
        expect(treeVerdictsOf(stdout)).toStrictEqual(['Passed', 'Passed', 'Passed', 'Passed']);
        expect(JSON.parse(baseline)).toStrictEqual({ typescript: {} });
    });

    const TREE_GATES = [
        'Suppressions (directives)',
        'Markdown (prose)',
        'Names (tree)',
        'Secrets (credentials)',
    ] as const;
    const TREE_PASSES = onlyPasses('suppressions', 'markdown', 'names', 'secrets');

    test('judges a repository nobody has added a file to yet, its Makefile included', () => {
        // Given - a repository initialised over a tree nobody has added
        const project = projectWith({ isRepository: false, makefile: SIX_TARGETS });
        execFileSync('git', ['init', '--quiet'], { cwd: project });

        // When - the quality checks run
        const names = namesPassOf(project);

        // Then - the new Makefile answers the contract, and the Names pass is green
        expect(names).toContain('Passed');
    });

    test('refuses to judge a repository whose every file git ignores, in one line that says what to do', () => {
        // Given - a repository whose .gitignore ignores every file, itself included
        const project = projectWith({ isRepository: false, makefile: SIX_TARGETS });
        writeFileSync(join(project, '.gitignore'), '*\n');
        execFileSync('git', ['init', '--quiet'], { cwd: project });

        // When - the tree gates run
        const result = spawnSync('node', [SELECTING_BIN, 'check'], {
            cwd: project,
            encoding: 'utf8',
            env: inProject(project, TREE_PASSES),
        });
        const refusal = `found: nothing to read under ${realpathSync(project)}: git ignores every file it holds · why: a sweep that reads nothing would turn every gate above it green · fix: take the project's files out of .gitignore, then run again · read: docs/06-quality-checks.md#an-unreadable-tree`;

        // Then - every tree gate says that one line, and no stack, and the run fails where a silent gate would pass on everything
        for (const label of TREE_GATES) {
            expect(saidBy(result.stdout, label)).toStrictEqual([refusal]);
        }
        expect(result.status).toBe(1);
    });

    test('refuses to judge a directory outside git that holds folders and no file, in one line', () => {
        // Given - a directory no repository holds, with one empty folder in it
        const created = temporaryDirectory('spec-names-foldered-');
        const project = realpathSync(created);
        mkdirSync(join(project, 'src'));

        // When - the tree gates run
        const result = spawnSync('node', [SELECTING_BIN, 'check'], {
            cwd: project,
            encoding: 'utf8',
            env: inProject(project, TREE_PASSES),
        });
        const refusal = `found: nothing to read under ${project}: it holds folders and no file · why: a sweep that reads nothing would turn every gate above it green · fix: add the project's files, then run again · read: docs/06-quality-checks.md#an-unreadable-tree`;

        // Then - every tree gate says that one line, and the run fails
        for (const label of TREE_GATES) {
            expect(saidBy(result.stdout, label)).toStrictEqual([refusal]);
        }
        expect(result.status).toBe(1);
    });

    test('accepts a repository whose Makefile answers the six gestures', () => {
        // Given - a repository whose Makefile writes a rule for each of the six
        const project = projectWith({ makefile: SIX_TARGETS });

        // When - the quality checks run
        const names = namesPassOf(project);

        // Then - the contract holds, and the Names pass is green
        expect(names).toContain('Passed');
    });

    test('accepts a repository whose Makefile answers more than the six gestures', () => {
        // Given - a repository whose Makefile writes the six, then a test-mobile and a release of its own
        const project = projectWith({
            makefile: `${SIX_TARGETS}\ntest-mobile:\n\tnpm run test:mobile\n\nrelease:\n\tnpm publish\n`,
        });

        // When - the quality checks run
        const names = namesPassOf(project);

        // Then - the contract only requires, so the extra targets are no finding, and the Names pass is green
        expect(names).not.toContain('names/');
        expect(names).toContain('✓ Passed');
    });

    test('names each gesture a repository Makefile has no rule for', () => {
        // Given - a Makefile with no fix and no check, an assignment and a comment standing in for them
        const project = projectWith({ makefile: FOUR_TARGETS });

        // When - the quality checks run
        const names = namesPassOf(project);

        // Then - the two missing gestures are named, one finding each, and the pass fails
        expect(names).toContain(
            'names/makefile-answers-every-gesture  Makefile  `make fix` has no rule — every repository answers `make` install, build, lint, fix, test and check',
        );
        expect(names).toContain(
            'names/makefile-answers-every-gesture  Makefile  `make check` has no rule — every repository answers `make` install, build, lint, fix, test and check',
        );
        expect(names).not.toContain('`make install`');
        expect(names).not.toContain('`make test`');
        expect(names).toContain('Failed with exit code 1');
    });

    test('refuses a repository with no Makefile at all', () => {
        // Given - a repository with no Makefile
        const project = projectWith({});

        // When - the quality checks run
        const names = namesPassOf(project);

        // Then - the absence is one finding
        expect(names).toContain(
            'names/repository-has-makefile  Makefile  the repository has no Makefile — every repository answers `make` install, build, lint, fix, test and check',
        );
        expect(names).toContain('Failed with exit code 1');
    });

    test('passes a linter run whatever the Names pass it ran for the ratchet says', () => {
        // Given - a repository with no Makefile, which the Names pass refuses and the linter does not
        const project = projectWith({});

        // When - the linter alone runs
        const result = spawnSync('node', [SELECTING_BIN, 'check'], {
            cwd: project,
            encoding: 'utf8',
            env: inProject(project, onlyPasses('oxlint')),
        });

        // Then - the Names pass ran for the ratchet's sake only: it prints nothing and weighs nothing in the verdict
        expect(result.stdout).toContain('Oxlint Check');
        expect(result.stdout).not.toContain('Names (tree)');
        expect(result.stdout).toContain('All checks passed');
        expect(result.status).toBe(0);
    });

    test('refuses a repository whose tracked Makefile is deleted from the disk', () => {
        // Given - a repository that tracks a Makefile, since deleted and not yet committed
        const project = projectWith({ makefile: SIX_TARGETS });
        rmSync(join(project, 'Makefile'));

        // When - the quality checks run
        const names = namesPassOf(project);

        // Then - the deleted file answers nothing, and the absence is one finding
        expect(names).toContain('names/repository-has-makefile');
        expect(names).toContain('Failed with exit code 1');
    });

    test('asks a directory that is no repository for nothing', () => {
        // Given - the same tree with no Makefile, and no repository around it
        const project = projectWith({ isRepository: false });

        // When - the quality checks run
        const names = namesPassOf(project);

        // Then - a workspace member or a bare directory owes the root's gestures nothing
        expect(names).toContain('Passed');
    });

    test('records a missing gesture in the ratchet, and the run it records is green', () => {
        // Given - a repository missing two gestures, recorded by the baseline command
        const project = projectWith({ makefile: FOUR_TARGETS });
        execFileSync('node', [SELECTING_BIN, 'baseline'], {
            cwd: project,
            encoding: 'utf8',
            env: inProject(project),
        });

        // When - the linter and the Names pass run
        const result = spawnSync('node', [SELECTING_BIN, 'check'], {
            cwd: project,
            encoding: 'utf8',
            env: inProject(project, onlyPasses('oxlint', 'names')),
        });
        const names = passOf(result.stdout, 'Names (tree)');

        // Then - the entry holds both, the section states it in its one line, and the Names pass is green
        expect(result.stdout).toContain(
            'jterrazz.baseline.json › typescript: 2 held across 1 rule',
        );
        expect(names).toContain('Passed');
    });

    test('counts a missing gesture in the ratchet line of a linter run the Names pass is left out of', () => {
        // Given - a repository missing two gestures, recorded by the baseline command
        const project = projectWith({ makefile: FOUR_TARGETS });
        execFileSync('node', [SELECTING_BIN, 'baseline'], {
            cwd: project,
            encoding: 'utf8',
            env: inProject(project),
        });

        // When - the linter alone runs
        const result = spawnSync('node', [SELECTING_BIN, 'check'], {
            cwd: project,
            encoding: 'utf8',
            env: inProject(project, onlyPasses('oxlint')),
        });

        // Then - the held line counts the Names pass's report, and the Names pass prints nothing
        expect(result.stdout).toContain(
            'jterrazz.baseline.json › typescript: 2 held across 1 rule',
        );
        expect(result.stdout).not.toContain('Names (tree)');
        expect(result.status).toBe(0);
    });
});
