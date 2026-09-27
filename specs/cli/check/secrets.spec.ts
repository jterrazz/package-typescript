import { execFileSync, spawnSync } from 'node:child_process';
import {
    chmodSync,
    cpSync,
    mkdirSync,
    readFileSync,
    realpathSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import { delimiter, dirname, join, resolve } from 'node:path';
import { afterAll, describe, expect, test } from 'vitest';

import { newDirectory, temporaryDirectory } from '../_setup/temporary-directory.js';

// Which scanner answers depends on the machine's PATH, so the chain names it by handing over a PATH.

const BIN = resolve(import.meta.dirname, '../../../bin/typescript.js');
const FIXTURE = resolve(import.meta.dirname, '_fixtures/secrets/leaked');

const project = newDirectory('spec-secrets-');

afterAll(() => {
    rmSync(project, { force: true, recursive: true });
});

function pathWithoutGitleaks(): string {
    const probe = spawnSync('which', ['gitleaks'], { encoding: 'utf8' });
    const binary = probe.stdout.trim();

    const { PATH = '' } = process.env;

    return PATH.split(delimiter)
        .filter((directory) => binary === '' || !binary.startsWith(`${directory}/`))
        .join(delimiter);
}

function gitleaksStub(): { directory: string; record: string } {
    const directory = temporaryDirectory('spec-secrets-gitleaks-');
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

describe('secrets', () => {
    test('refuses a committed credential, and forgives the line that declares itself fake', () => {
        // Given - a project whose notes carry one live-looking key and one declared-fake key
        cpSync(FIXTURE, project, { recursive: true });

        // When - the quality checks run with no gitleaks on PATH, so the built-in patterns answer
        const result = spawnSync('node', [BIN, 'check'], {
            cwd: project,
            encoding: 'utf8',
            env: { ...process.env, PATH: pathWithoutGitleaks() },
        });

        // Then - the pass names the live-looking key, by rule id, file and line
        expect(result.status).toBe(1);
        expect(result.stdout).toContain('Secrets (credentials)');
        expect(result.stdout).toContain(
            'NOTES.md:3:1: error secrets(no-aws-key): line 3 looks like an aws access key',
        );

        // Then - and says nothing about the line that declares itself a sample
        expect(result.stdout).not.toContain('line 5');
    });

    test('names each of the ten shapes the built-in scanner knows, by its own rule and line', () => {
        // Given - the same notes, carrying one credential of every shape below the two keys
        const created = temporaryDirectory('spec-secrets-shapes-');
        cpSync(FIXTURE, created, { recursive: true });

        // When - the quality checks run with the built-in patterns answering
        const result = spawnSync('node', [BIN, 'check'], {
            cwd: created,
            encoding: 'utf8',
            env: { ...process.env, PATH: pathWithoutGitleaks() },
        });
        const findings = result.stdout
            .split('\n')
            .filter((line) => line.includes(': error secrets('));

        // Then - one finding per shape, each under its own rule id, on its own line
        expect(findings).toStrictEqual([
            'NOTES.md:3:1: error secrets(no-aws-key): line 3 looks like an aws access key',
            'NOTES.md:9:1: error secrets(no-private-key): line 9 looks like a private key block',
            'NOTES.md:10:1: error secrets(no-github-token): line 10 looks like a github token',
            'NOTES.md:11:1: error secrets(no-slack-token): line 11 looks like a slack token',
            'NOTES.md:12:1: error secrets(no-tailscale-key): line 12 looks like a tailscale key',
            'NOTES.md:13:1: error secrets(no-signed-jwt): line 13 looks like a signed jwt',
            'NOTES.md:14:1: error secrets(no-grafana-token): line 14 looks like a grafana token',
            'NOTES.md:15:1: error secrets(no-api-key): line 15 looks like an api key',
            'NOTES.md:16:1: error secrets(no-iban): line 16 looks like an iban',
            'NOTES.md:17:1: error secrets(no-service-token): line 17 looks like a service token',
        ]);
    });

    test('hands gitleaks every file git does not ignore that a tree gate judges, and nothing beside them', () => {
        // Given - a repository with tracked notes, a tracked spec ground, a tracked folder the run is told to overlook, an untracked scratch file and an ignored one
        const created = temporaryDirectory('spec-secrets-scanner-');
        const repository = realpathSync(created);
        const files: Record<string, string> = {
            'NOTES.md': '# Notes\n',
            'index.ts': 'export const title = "spec";\n',
            'notes/draft.md': '# Draft\n',
            'package.json': '{ "name": "spec-secrets-scanner", "private": true }\n',
            'specs/_fixtures/leaky/NOTES.md': '# Ground\n',
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
        writeFileSync(join(repository, 'data/local.md'), '# Ignored\n');
        writeFileSync(join(repository, '.gitignore'), 'data/local.md\n');
        const { directory, record } = gitleaksStub();

        // When - the quality checks run with a recording gitleaks first on PATH, told to overlook notes/
        spawnSync('node', [BIN, 'check', '--ignore-pattern', 'notes/**'], {
            cwd: repository,
            encoding: 'utf8',
            env: { ...process.env, PATH: `${directory}${delimiter}${process.env.PATH ?? ''}` },
        });
        const [argv = '', cwd = '', ...scanned] = readFileSync(record, 'utf8').trim().split('\n');

        // Then - gitleaks scans a directory holding exactly the non-ignored, ground-free, not-overlooked files
        expect(argv).toBe('argv dir . --no-banner --redact --exit-code 1');
        expect(cwd.startsWith(`cwd ${repository}`)).toBe(false);
        expect(scanned).toStrictEqual([
            './.gitignore',
            './NOTES.md',
            './data/scratch.md',
            './index.ts',
            './package.json',
            './tsconfig.json',
        ]);
    });
});
