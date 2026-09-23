import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, onTestFinished, test } from 'vitest';

/*
 * A chain, for the ground's sake: what the Names pass asks of a REPOSITORY
 * needs one, and a fixture cannot be one — git refuses to track a nested
 * `.git`, the runner copies files rather than initialising a repository, and a
 * copied fixture has every file it carries already staged.
 */

const BIN = resolve(import.meta.dirname, '../../../bin/typescript.sh');

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

/** A small green project, a repository or a bare directory, with the Makefile given. */
function projectWith({
    isRepository = true,
    makefile,
}: {
    isRepository?: boolean;
    makefile?: string;
}): string {
    const project = mkdtempSync(resolve(tmpdir(), 'spec-names-repository-'));
    onTestFinished(() => {
        rmSync(project, { force: true, recursive: true });
    });
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

/** What the Names (tree) pass printed, header to verdict. */
function namesPassOf(project: string): string {
    const result = spawnSync('bash', [BIN, 'check'], {
        cwd: project,
        encoding: 'utf8',
        env: inProject(project),
    });

    return result.stdout.slice(
        result.stdout.indexOf('Names (tree)'),
        result.stdout.indexOf('Secrets (credentials)'),
    );
}

test('never reports a root nobody has git added, tracked or clean alike', () => {
    // Given - a tracked project answering the six gestures, and a local data/ folder nobody has staged
    const project = projectWith({ makefile: SIX_TARGETS });
    mkdirSync(join(project, 'data'));
    writeFileSync(join(project, 'data/report.txt'), 'a local scratch note, never staged\n');

    // When - the quality checks run without that folder ever staged
    const names = namesPassOf(project);

    // Then - the untracked root is no finding, and the Names pass is green
    expect(names).not.toContain('data/');
    expect(names).toContain('Passed');
});

/** One pass of a report, from its header to the next pass's. */
function passOf(stdout: string, label: string, next: string): string {
    return stdout.slice(stdout.indexOf(label), stdout.indexOf(next));
}

test('judges the tracked files alone in every tree gate, the linter included', () => {
    // Given - a green repository, and an untracked data/ folder holding a broken link, a live-looking key and a debugger statement
    const project = projectWith({ makefile: SIX_TARGETS });
    mkdirSync(join(project, 'data'));
    /* Spelled in two halves, so this file carries no key of its own. */
    const key = ['AKIA', 'Q7RJ4KDNPZ2WX6TB'].join('');
    writeFileSync(
        join(project, 'data/NOTES.md'),
        `# Scratch\n\nSee [the plan](./missing.md) and the key ${key}.\n`,
    );
    writeFileSync(
        join(project, 'data/scratch.ts'),
        'export function stop(): void {\n    debugger;\n}\n',
    );

    // When - the quality checks run, and the baseline is recorded
    const result = spawnSync('bash', [BIN, 'check'], {
        cwd: project,
        encoding: 'utf8',
        env: inProject(project),
    });
    execFileSync('bash', [BIN, 'baseline'], {
        cwd: project,
        encoding: 'utf8',
        env: inProject(project),
    });
    const lint = passOf(result.stdout, 'Oxlint Check', 'Oxfmt Check');
    const markdown = passOf(result.stdout, 'Markdown (prose)', 'Names (tree)');
    const secrets = passOf(result.stdout, 'Secrets (credentials)', 'END');

    // Then - no gate reads the untracked folder: each pass is green, and the baseline records nothing
    expect(lint).toContain('Passed');
    expect(markdown).toContain('Passed');
    expect(secrets).toContain('Passed');
    expect(readFileSync(join(project, 'typescript.baseline.json'), 'utf8')).toBe('{}\n');
});

test('refuses to judge a repository that tracks nothing yet, rather than pass it', () => {
    // Given - a repository initialised over a tree nobody has added
    const project = projectWith({ isRepository: false, makefile: SIX_TARGETS });
    execFileSync('git', ['init', '--quiet'], { cwd: project });

    // When - the quality checks run
    const result = spawnSync('bash', [BIN, 'check'], {
        cwd: project,
        encoding: 'utf8',
        env: inProject(project),
    });
    const refusal = `nothing to read under ${realpathSync(project)}`;

    // Then - every tree gate names the empty sweep and fails, where a silent one would pass on everything
    expect(passOf(result.stdout, 'Markdown (prose)', 'Names (tree)')).toContain(refusal);
    expect(passOf(result.stdout, 'Names (tree)', 'Secrets (credentials)')).toContain(refusal);
    expect(passOf(result.stdout, 'Secrets (credentials)', 'END')).toContain(refusal);
    expect(result.status).toBe(1);
});

test('accepts a repository whose Makefile answers the six gestures', () => {
    // Given - a repository whose Makefile writes a rule for each of the six
    const project = projectWith({ makefile: SIX_TARGETS });

    // When - the quality checks run
    const names = namesPassOf(project);

    // Then - the contract holds, and the Names pass is green
    expect(names).not.toContain('names-makefile');
    expect(names).toContain('Passed');
});

test('names each gesture a repository Makefile has no rule for', () => {
    // Given - a Makefile with no fix and no check, an assignment and a comment standing in for them
    const project = projectWith({ makefile: FOUR_TARGETS });

    // When - the quality checks run
    const names = namesPassOf(project);

    // Then - the two missing gestures are named, one finding each, and the pass fails
    expect(names).toContain(
        'names-makefile-target  Makefile  `make fix` has no rule — every repository answers `make` install, build, lint, fix, test and check',
    );
    expect(names).toContain(
        'names-makefile-target  Makefile  `make check` has no rule — every repository answers `make` install, build, lint, fix, test and check',
    );
    expect(names).not.toContain('`make install`');
    expect(names).not.toContain('`make test`');
    expect(names).toContain('Failed with exit code 1');
});

test('refuses a repository with no tracked Makefile at all', () => {
    // Given - a repository with no Makefile
    const project = projectWith({});

    // When - the quality checks run
    const names = namesPassOf(project);

    // Then - the absence is one finding
    expect(names).toContain(
        'names-makefile-absent  Makefile  the repository has no tracked Makefile — every repository answers `make` install, build, lint, fix, test and check',
    );
    expect(names).toContain('Failed with exit code 1');
});

test('asks a directory that is no repository for nothing', () => {
    // Given - the same tree with no Makefile, and no repository around it
    const project = projectWith({ isRepository: false });

    // When - the quality checks run
    const names = namesPassOf(project);

    // Then - a workspace member or a bare directory owes the root's gestures nothing
    expect(names).not.toContain('names-makefile');
    expect(names).toContain('Passed');
});

test('records a missing gesture in the ratchet, and the run it records is green', () => {
    // Given - a repository missing two gestures, recorded by the baseline command
    const project = projectWith({ makefile: FOUR_TARGETS });
    execFileSync('bash', [BIN, 'baseline'], {
        cwd: project,
        encoding: 'utf8',
        env: inProject(project),
    });

    // When - the quality checks run
    const result = spawnSync('bash', [BIN, 'check'], {
        cwd: project,
        encoding: 'utf8',
        env: inProject(project),
    });
    const names = result.stdout.slice(
        result.stdout.indexOf('Names (tree)'),
        result.stdout.indexOf('Secrets (credentials)'),
    );

    // Then - the entry holds both, the file states it in its one line, and the Names pass is green
    expect(result.stdout).toContain('typescript.baseline.json: 2 held across 1 rule');
    expect(names).not.toContain('names-makefile');
    expect(names).toContain('Passed');
});

/** npm's INIT_CWD names the project the CLI answers for; a chain started under npm must name its own. */
function inProject(project: string): NodeJS.ProcessEnv {
    return { ...process.env, INIT_CWD: project };
}
