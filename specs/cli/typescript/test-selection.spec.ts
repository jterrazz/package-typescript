import { directory } from '@jterrazz/test';
import { execFileSync } from 'node:child_process';
import { appendFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { cli } from '../packed-cli.specification.js';

const CONSUMER = resolve(import.meta.dirname, '../__setup__/packed/consumer.ts');

const OUTSIDE_CI = { CI: '', TYPESCRIPT_CAPACITY: 'cpus=1,memory=64g' };

const typescript = cli.with({ env: OUTSIDE_CI });

const git = (workdir: string, ...args: string[]): void => {
    execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], {
        cwd: workdir,
        stdio: 'pipe',
    });
};

// invariant: the suite stage runs only over what the module tests leave, so the measure names the source no module test reaches, and its dry run records every test file; the repository is committed, so the change since its base is what the spec writes after.
function recorded(workdir: string): void {
    git(workdir, 'init', '--quiet', '--initial-branch=main');
    git(workdir, 'add', '--all');
    git(workdir, 'commit', '--quiet', '--message', 'first');
    execFileSync('node', [CONSUMER, 'typescript', 'mutation', '--mutate', 'src/z.ts'], {
        cwd: workdir,
        env: { ...process.env, ...OUTSIDE_CI },
        stdio: 'pipe',
    });
}

const ranLineOf = (text: string): string | undefined => /^.* ran .*\n/mu.exec(text)?.[0];

// invariant: the measure that recorded the suite appended its own pass first; a test run's outcomes are the lines of the `test` command.
const testOutcomesOf = (content: string): unknown[] =>
    content
        .split('\n')
        .filter((line) => line.includes('"command":"test"'))
        .map((line): unknown => JSON.parse(line));

describe('test selection', () => {
    test('typescript test — a change to one source runs the test files the record says reach it, and records each', async () => {
        // Given - the consumer recorded once, then x changed
        const result = await typescript
            .fixture(directory('./__fixtures__/test-selection/'))
            .prepare((workdir) => {
                recorded(workdir);
                writeFileSync(
                    join(workdir, 'src/x.ts'),
                    "export function x(): string {\n    return 'x' + '';\n}\n",
                );
            })
            .exec('typescript test');

        // Then - x's module test alone ran, and the outcomes name it beside the run
        expect(result.exitCode).toBe(0);
        expect(ranLineOf(result.stdout.text)).toBe(
            ' TYPESCRIPT  ran 1 of 3 test files the change reaches\n',
        );
        expect(
            testOutcomesOf(result.file('.artifacts/check/outcomes.jsonl').content),
        ).toMatchObject([
            { command: 'test', kind: 'pass', name: 'Tests', status: 'green' },
            { kind: 'file', name: 'src/__tests__/x.test.ts', project: 'unit', status: 'green' },
        ]);
    });

    test('typescript test — a change to the test config runs every test file, and says why', async () => {
        // Given - the consumer recorded once, then its vitest config changed
        const result = await typescript
            .fixture(directory('./__fixtures__/test-selection/'))
            .prepare((workdir) => {
                recorded(workdir);
                appendFileSync(join(workdir, 'vitest.config.ts'), '\n');
            })
            .exec('typescript test');

        // Then - every file ran
        expect(result.exitCode).toBe(0);
        expect(ranLineOf(result.stdout.text)).toBe(
            ' TYPESCRIPT  ran every test file: the change reaches vitest.config.ts, which every test reads\n',
        );
        expect(testOutcomesOf(result.file('.artifacts/check/outcomes.jsonl').content)).toHaveLength(
            4,
        );
    });

    test('typescript test — a project no mutation run has recorded runs every test file, on the workers its capacity holds', async () => {
        // Given - the consumer committed, never measured, then x changed
        const result = await typescript
            .fixture(directory('./__fixtures__/test-selection/'))
            .prepare((workdir) => {
                git(workdir, 'init', '--quiet', '--initial-branch=main');
                git(workdir, 'add', '--all');
                git(workdir, 'commit', '--quiet', '--message', 'first');
                writeFileSync(
                    join(workdir, 'src/x.ts'),
                    "export function x(): string {\n    return 'x' + '';\n}\n",
                );
            })
            .exec('typescript test');

        // Then - every file ran, on the workers the capacity given holds, and the run says what it sized them by
        expect(result.exitCode).toBe(0);
        expect(ranLineOf(result.stdout.text)).toBe(
            ' TYPESCRIPT  ran every test file: no record of what each test reaches, which `typescript mutation` leaves\n',
        );
        expect(/^.*capacity: .*\n/mu.exec(result.stdout.text)?.[0]).toBe(
            ' TYPESCRIPT  capacity: 1 cpus, 64.0 GB, given by TYPESCRIPT_CAPACITY: this gate 1 cpus, 56.0 GB · Vitest at 300 MB, 1 worker(s) at 600 MB: cpus bind\n',
        );
        expect(testOutcomesOf(result.file('.artifacts/check/outcomes.jsonl').content)).toHaveLength(
            4,
        );
    });
});
