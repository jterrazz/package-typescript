import { execFileSync, spawnSync } from 'node:child_process';
import {
    chmodSync,
    cpSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    realpathSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join, resolve } from 'node:path';
import { afterAll, expect, onTestFinished, test } from 'vitest';

/*
 * A chain, not a document — and the product command all the same. What no
 * document can state here is the MACHINE: the Secrets pass runs gitleaks where
 * the machine has it and its own ten patterns where it does not, so the block a
 * document would freeze is a property of the developer's PATH, not of the
 * command. The chain names the engine by handing over a PATH without gitleaks
 * on it, and asserts the one thing that must hold on every machine: the leak
 * fails the run, and the line that declares itself fake does not. The other
 * engine is named the same way — a `gitleaks` on PATH that records what it was
 * handed — and the ground there is a real repository, since what the engine
 * must receive is the TRACKED set.
 */

const BIN = resolve(import.meta.dirname, '../../../bin/typescript.sh');
const FIXTURE = resolve(import.meta.dirname, 'fixtures/secrets/leaked');

const project = mkdtempSync(resolve(tmpdir(), 'spec-secrets-'));

afterAll(() => {
    rmSync(project, { force: true, recursive: true });
});

/** The machine's PATH, minus any directory that answers for `gitleaks`. */
function pathWithoutGitleaks(): string {
    const probe = spawnSync('which', ['gitleaks'], { encoding: 'utf8' });
    const binary = probe.stdout.trim();

    const { PATH = '' } = process.env;

    return PATH.split(delimiter)
        .filter((directory) => binary === '' || !binary.startsWith(`${directory}/`))
        .join(delimiter);
}

test('refuses a committed credential, and forgives the line that declares itself fake', () => {
    // Given - a project whose notes carry one live-looking key and one declared-fake key
    cpSync(FIXTURE, project, { recursive: true });

    // When - the quality checks run with no gitleaks on PATH, so the built-in patterns answer
    const result = spawnSync('bash', [BIN, 'check'], {
        cwd: project,
        encoding: 'utf8',
        env: { ...process.env, PATH: pathWithoutGitleaks() },
    });

    // Then - the pass names the live-looking key, by rule id, file and line
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('Secrets (credentials)');
    expect(result.stdout).toContain(
        'secrets-aws-key  NOTES.md  line 3 looks like an aws access key',
    );

    // Then - and says nothing about the line that declares itself a sample
    expect(result.stdout).not.toContain('line 5');
});

/** A `gitleaks` that answers `version`, and records what a scan was handed beside itself. */
function gitleaksStub(): { directory: string; record: string } {
    const directory = mkdtempSync(resolve(tmpdir(), 'spec-secrets-gitleaks-'));
    onTestFinished(() => {
        rmSync(directory, { force: true, recursive: true });
    });
    const record = join(directory, 'record.txt');
    const stub = join(directory, 'gitleaks');
    writeFileSync(
        stub,
        [
            '#!/bin/sh',
            '[ "$1" = version ] && exit 0',
            `{ echo "argv $*"; echo "cwd $(pwd -P)"; find . -type f | LC_ALL=C sort; } > '${record}'`,
            'exit 0',
            '',
        ].join('\n'),
    );
    chmodSync(stub, 0o755);

    return { directory, record };
}

test('hands gitleaks the tracked files a tree gate judges, and nothing beside them', () => {
    // Given - a repository with tracked notes, a tracked spec ground, a tracked folder the run is told to overlook, and an untracked scratch file
    const created = mkdtempSync(resolve(tmpdir(), 'spec-secrets-engine-'));
    onTestFinished(() => {
        rmSync(created, { force: true, recursive: true });
    });
    const repository = realpathSync(created);
    const files: Record<string, string> = {
        'NOTES.md': '# Notes\n',
        'index.ts': 'export const title = "spec";\n',
        'notes/draft.md': '# Draft\n',
        'package.json': '{ "name": "spec-secrets-engine", "private": true }\n',
        'specs/fixtures/leaky/NOTES.md': '# Ground\n',
        'tsconfig.json': '{ "compilerOptions": { "strict": true, "noEmit": true } }\n',
    };
    for (const [path, content] of Object.entries(files)) {
        mkdirSync(dirname(join(repository, path)), { recursive: true });
        writeFileSync(join(repository, path), content);
    }
    execFileSync('git', ['init', '--quiet'], { cwd: repository });
    execFileSync('git', ['add', '.'], { cwd: repository });
    mkdirSync(join(repository, 'data'));
    writeFileSync(join(repository, 'data/scratch.md'), '# Never staged\n');
    const { directory, record } = gitleaksStub();

    // When - the quality checks run with a recording gitleaks first on PATH, told to overlook notes/
    spawnSync('bash', [BIN, 'check', '--ignore-pattern', 'notes/**'], {
        cwd: repository,
        encoding: 'utf8',
        env: { ...process.env, PATH: `${directory}${delimiter}${process.env.PATH ?? ''}` },
    });
    const [argv = '', cwd = '', ...scanned] = readFileSync(record, 'utf8').trim().split('\n');

    // Then - gitleaks scans a directory holding exactly the tracked, ground-free, not-overlooked files
    expect(argv).toBe('argv dir . --no-banner --redact --exit-code 1');
    expect(cwd.startsWith(`cwd ${repository}`)).toBe(false);
    expect(scanned).toStrictEqual([
        './NOTES.md',
        './index.ts',
        './package.json',
        './tsconfig.json',
    ]);
});
