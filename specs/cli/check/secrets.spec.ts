import { directory } from '@jterrazz/test';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { onlyPasses } from '../_setup/check-passes.js';
import { repository } from '../_setup/repository.js';
import { cli } from '../cli.specification.js';

// outside: which scanner answers depends on the machine's PATH, so the chain names it by handing over a PATH.

function pathWithoutGitleaks(): string {
    const binary = spawnSync('which', ['gitleaks'], { encoding: 'utf8' }).stdout.trim();
    return (process.env.PATH ?? '')
        .split(delimiter)
        .filter((folder) => binary === '' || !binary.startsWith(`${folder}/`))
        .join(delimiter);
}

describe('secrets', () => {
    test('names each of the ten shapes the built-in scanner knows, by its own rule and line, and forgives the line that declares itself fake', async () => {
        // Given - notes carrying one credential of every shape, and one key declared a sample
        // When - the quality checks run with no gitleaks on PATH, so the built-in patterns answer
        const result = await cli
            .with({ env: { ...onlyPasses('secrets'), PATH: pathWithoutGitleaks() } })
            .fixture(directory('./_fixtures/secrets/leaked/'))
            .exec('check');

        // Then - one finding per shape, each under its own rule id, on its own line, and none on the sample's line 5
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toMatch(`
             START  Running quality checks

             RUN  Secrets (credentials)

            NOTES.md:3:1: error secrets(no-aws-key): line 3 looks like an aws access key
            NOTES.md:9:1: error secrets(no-private-key): line 9 looks like a private key block
            NOTES.md:10:1: error secrets(no-github-token): line 10 looks like a github token
            NOTES.md:11:1: error secrets(no-slack-token): line 11 looks like a slack token
            NOTES.md:12:1: error secrets(no-tailscale-key): line 12 looks like a tailscale key
            NOTES.md:13:1: error secrets(no-signed-jwt): line 13 looks like a signed jwt
            NOTES.md:14:1: error secrets(no-grafana-token): line 14 looks like a grafana token
            NOTES.md:15:1: error secrets(no-api-key): line 15 looks like an api key
            NOTES.md:16:1: error secrets(no-iban): line 16 looks like an iban
            NOTES.md:17:1: error secrets(no-service-token): line 17 looks like a service token
            ✗ Failed with exit code 1

             END  Finalizing quality checks

            ✗ Some checks failed
        `);
    });

    test('hands gitleaks every file git does not ignore that a tree gate judges, and nothing beside them', async () => {
        // Given - a repository with tracked notes, a tracked spec ground, a tracked folder the run is told to overlook, an untracked scratch file and an ignored one
        // When - the quality checks run with a recording gitleaks, kept in a folder git ignores, first on PATH, told to overlook notes/
        const result = await cli
            .with({
                env: {
                    ...onlyPasses('secrets'),
                    PATH: `$WORKDIR/tools${delimiter}${process.env.PATH ?? ''}`,
                },
            })
            .fixture(directory('./_fixtures/secrets/scanned/'))
            .prepare((workdir) => {
                writeFileSync(join(workdir, '.gitignore'), 'data/local.md\ntools/\n');
                repository(workdir);
                mkdirSync(join(workdir, 'data'));
                writeFileSync(join(workdir, 'data/scratch.md'), '# Never staged\n');
                writeFileSync(join(workdir, 'data/local.md'), '# Ignored\n');
            })
            .exec("check --ignore-pattern 'notes/**'");

        // Then - gitleaks scans a folder beside the repository holding exactly the non-ignored, ground-free, not-overlooked files
        expect(result.file('tools/record.txt').content).toBe(
            [
                'argv dir . --no-banner --redact --exit-code 1',
                'scanned beside the repository',
                './.gitignore',
                './NOTES.md',
                './data/scratch.md',
                './index.ts',
                './package.json',
                './tsconfig.json',
                '',
            ].join('\n'),
        );
    });
});
