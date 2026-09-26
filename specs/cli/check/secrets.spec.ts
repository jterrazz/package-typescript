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

import { newDirectory, temporaryDirectory } from '../temporary-directory.js';

// Which engine answers depends on the machine's PATH, so the chain names it by handing over a PATH.

const BIN = resolve(import.meta.dirname, '../../../bin/typescript.sh');
const FIXTURE = resolve(import.meta.dirname, 'fixtures/secrets/leaked');

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
        const result = spawnSync('bash', [BIN, 'check'], {
            cwd: project,
            encoding: 'utf8',
            env: { ...process.env, PATH: pathWithoutGitleaks() },
        });

        // Then - the pass names the live-looking key, by rule id, file and line
        expect(result.status).toBe(1);
        expect(result.stdout).toContain('Secrets (credentials)');
        expect(result.stdout).toContain(
            'secrets/no-aws-key  NOTES.md  line 3 looks like an aws access key',
        );

        // Then - and says nothing about the line that declares itself a sample
        expect(result.stdout).not.toContain('line 5');
    });

    test('names each of the ten shapes the built-in engine knows, by its own rule and line', () => {
        // Given - the same notes, carrying one credential of every shape below the two keys
        const created = temporaryDirectory('spec-secrets-shapes-');
        cpSync(FIXTURE, created, { recursive: true });

        // When - the quality checks run with the built-in patterns answering
        const result = spawnSync('bash', [BIN, 'check'], {
            cwd: created,
            encoding: 'utf8',
            env: { ...process.env, PATH: pathWithoutGitleaks() },
        });
        const findings = result.stdout.split('\n').filter((line) => line.startsWith('secrets/'));

        // Then - one finding per shape, each under its own rule id, on its own line
        expect(findings).toStrictEqual([
            'secrets/no-aws-key  NOTES.md  line 3 looks like an aws access key',
            'secrets/no-private-key  NOTES.md  line 9 looks like a private key block',
            'secrets/no-github-token  NOTES.md  line 10 looks like a github token',
            'secrets/no-slack-token  NOTES.md  line 11 looks like a slack token',
            'secrets/no-tailscale-key  NOTES.md  line 12 looks like a tailscale key',
            'secrets/no-signed-jwt  NOTES.md  line 13 looks like a signed jwt',
            'secrets/no-grafana-token  NOTES.md  line 14 looks like a grafana token',
            'secrets/no-api-key  NOTES.md  line 15 looks like an api key',
            'secrets/no-iban  NOTES.md  line 16 looks like an iban',
            'secrets/no-service-token  NOTES.md  line 17 looks like a service token',
        ]);
    });

    test('hands gitleaks every file git does not ignore that a tree gate judges, and nothing beside them', () => {
        // Given - a repository with tracked notes, a tracked spec ground, a tracked folder the run is told to overlook, an untracked scratch file and an ignored one
        const created = temporaryDirectory('spec-secrets-engine-');
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
        writeFileSync(join(repository, 'data/local.md'), '# Ignored\n');
        writeFileSync(join(repository, '.gitignore'), 'data/local.md\n');
        const { directory, record } = gitleaksStub();

        // When - the quality checks run with a recording gitleaks first on PATH, told to overlook notes/
        spawnSync('bash', [BIN, 'check', '--ignore-pattern', 'notes/**'], {
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
