import { directory } from '@jterrazz/test';
import { chmodSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { git, repository } from '../__setup__/repository.js';
import { cli } from '../cli.specification.js';

// invariant: the ground cannot be a fixture: a `.git`, a detached HEAD and an executable stub on PATH are what git never tracks.
const committed = (workdir: string): void => {
    repository(workdir);
    git(
        workdir,
        '-c',
        'user.name=spec',
        '-c',
        'user.email=spec@spec',
        'commit',
        '--quiet',
        '-m',
        'first',
    );
};

const locked = (workdir: string): void => {
    writeFileSync(join(workdir, 'package-lock.json'), '{}\n');
};

// outside: the rehearsal hands its run to docker, which a spec cannot start; the stub records what it was handed and answers a code of its own.
const stubbedDocker = (workdir: string): void => {
    mkdirSync(join(workdir, 'bin'));
    writeFileSync(
        join(workdir, 'bin/docker'),
        '#!/bin/sh\nfor argument in "$@"; do echo "$argument"; done > "$(dirname "$0")/../handed.txt"\nexit 3\n',
    );
    chmodSync(join(workdir, 'bin/docker'), 0o755);
};

describe('rehearse', () => {
    test('refuses a folder that is no repository, a checkout on no branch and a repository with no lockfile, each in four parts', async () => {
        // Given - the sample app bare, then committed and detached with a lockfile, then a repository with none
        const bare = await cli.fixture(directory('../__fixtures__/sample-app/')).exec('rehearse');
        const detached = await cli
            .fixture(directory('../__fixtures__/sample-app/'))
            .prepare(locked)
            .prepare(committed)
            .prepare((workdir) => {
                git(workdir, 'checkout', '--quiet', '--detach');
            })
            .exec('rehearse');
        const unlocked = await cli
            .fixture(directory('../__fixtures__/sample-app/'))
            .prepare(repository)
            .exec('rehearse');

        // Then - each refused, reading the rehearsal's section
        expect([bare.exitCode, detached.exitCode, unlocked.exitCode]).toStrictEqual([1, 1, 1]);
        expect(bare.stdout).toMatch(`
            found: {{path}} is in no git repository · why: the rehearsal runs the gate on a fresh clone of a committed branch, installed from its lockfile, as the runner that publishes the release does · fix: run it from a clone or a worktree of the repository · read: docs/reference/commands.md#a-rehearsal-on-linux
        `);
        expect(detached.stdout).toMatch(`
            found: the checkout stands on no branch · why: the rehearsal runs the gate on a fresh clone of a committed branch, installed from its lockfile, as the runner that publishes the release does · fix: check out the branch to rehearse, or name it with --branch <name> · read: docs/reference/commands.md#a-rehearsal-on-linux
        `);
        expect(unlocked.stdout).toMatch(`
            found: {{path}} holds no lockfile · why: the rehearsal runs the gate on a fresh clone of a committed branch, installed from its lockfile, as the runner that publishes the release does · fix: commit the lockfile the package manager writes (package-lock.json, bun.lock or pnpm-lock.yaml) · read: docs/reference/commands.md#a-rehearsal-on-linux
        `);
    });

    test('rehearses the branch checked out with build, lint and test when none is named', async () => {
        // Given - a committed repository with a lockfile on its default branch, docker stubbed on PATH
        const result = await cli
            .fixture(directory('../__fixtures__/sample-app/'))
            .prepare(locked)
            .prepare(committed)
            .prepare((workdir) => {
                git(workdir, 'branch', '--quiet', '-M', 'trunk');
            })
            .prepare(stubbedDocker)
            .env({ PATH: `$WORKDIR/bin:${process.env.PATH ?? ''}` })
            .exec('rehearse');

        // Then - the branch and the default targets, in the header and in the run
        expect(result.stdout.text).toBe(
            ' TYPESCRIPT  Rehearsing trunk on Linux: a fresh clone in node:24, `make build lint test` as a GitHub runner runs it...\n\n',
        );
        expect(result.file('handed.txt').content.split('\n').slice(8, 11)).toStrictEqual([
            'REHEARSED_BRANCH=trunk',
            '-e',
            'REHEARSED_TARGETS=build lint test',
        ]);
    });

    test('hands docker the run of the branch and the targets it is named, and exits with its code', async () => {
        // Given - a committed repository with a lockfile, docker stubbed on PATH, and a branch and targets named
        const result = await cli
            .fixture(directory('../__fixtures__/sample-app/'))
            .prepare(locked)
            .prepare(committed)
            .prepare(stubbedDocker)
            .env({ PATH: `$WORKDIR/bin:${process.env.PATH ?? ''}` })
            .exec('rehearse --branch release --targets lint');

        // Then - the header, the run handed over whole, and the stub's code
        expect(result.exitCode).toBe(3);
        expect(result.stdout.text).toBe(
            ' TYPESCRIPT  Rehearsing release on Linux: a fresh clone in node:24, `make lint` as a GitHub runner runs it...\n\n',
        );
        expect(result.file('handed.txt').content.split('\n').slice(0, 11)).toStrictEqual([
            'run',
            '--rm',
            '--init',
            '-e',
            'CI=true',
            '-e',
            'GITHUB_ACTIONS=true',
            '-e',
            'REHEARSED_BRANCH=release',
            '-e',
            'REHEARSED_TARGETS=lint',
        ]);
    });
});
