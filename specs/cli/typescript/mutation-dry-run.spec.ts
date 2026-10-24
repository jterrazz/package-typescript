import { directory } from '@jterrazz/test';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { temporaryDirectory } from '../../__setup__/temporary-directory.js';
import { cli } from '../packed-cli.specification.js';

const CONSUMER = resolve(import.meta.dirname, '../__setup__/packed/consumer.ts');

const OUTSIDE_CI = { CI: '', TYPESCRIPT_CAPACITY: 'cpus=1,memory=64g' };

// invariant: the first run is the packed command the second one runs, in a repository git can list, outside CI and with no cold run asked, so the second reads its record.
function measuredOnce(workdir: string, range: string): void {
    execFileSync('git', ['init', '--quiet'], { cwd: workdir });
    execFileSync('node', [CONSUMER, 'typescript', 'mutation', '--mutate', range], {
        cwd: workdir,
        env: { ...process.env, ...OUTSIDE_CI },
        stdio: 'pipe',
    });
}

function unused(workdir: string): void {
    writeFileSync(join(workdir, 'src/unused.ts'), 'export const UNUSED = 1;\n');
}

function labelled(workdir: string): void {
    writeFileSync(
        join(workdir, 'src/labels.ts'),
        `const LABEL = 'bee';\n\nexport function labelOf(): string {\n    return \`\${LABEL}\`;\n}\n`,
    );
}

const dryRunOf = (text: string): string | undefined => /^.*dry run: .*\n/mu.exec(text)?.[0];

describe('mutation dry run', () => {
    test('typescript mutation — a change inside a command’s function runs the dry run over the one spec that ran it, and judges as a cold run does', async () => {
        // Given - the consumer measured once at command b's body, then that body rewritten line for line
        const result = await cli
            .fixture(directory('./__fixtures__/mutation-commands/'))
            .prepare((workdir) => {
                measuredOnce(workdir, 'src/b.ts:4-4');
                writeFileSync(
                    join(workdir, 'src/b.ts'),
                    "import { labelOf } from './labels.ts';\n\nexport function b(): string {\n    return labelOf() + '\\n';\n}\n",
                );
            })
            .env(OUTSIDE_CI)
            .exec('typescript mutation --mutate src/b.ts:4-4');
        const cold = await cli
            .fixture(directory('./__fixtures__/mutation-commands/'))
            .prepare((workdir) => {
                writeFileSync(
                    join(workdir, 'src/b.ts'),
                    "import { labelOf } from './labels.ts';\n\nexport function b(): string {\n    return labelOf() + '\\n';\n}\n",
                );
            })
            .env({ TYPESCRIPT_CAPACITY: 'cpus=1,memory=64g' })
            .exec('typescript mutation --mutate src/b.ts:4-4');

        // Then - the specs that only load b.ts sit the dry run out, and the verdict is the cold one
        expect([dryRunOf(result.stdout.text), dryRunOf(cold.stdout.text)]).toStrictEqual([
            ' TYPESCRIPT  dry run: 1 of 4 test files the change reaches, on 1 worker(s)\n',
            ' TYPESCRIPT  dry run: every test file, on 1 worker(s)\n',
        ]);
        expect([result.exitCode, result.stdout.text.split('\n').at(-2)]).toStrictEqual([
            cold.exitCode,
            cold.stdout.text.split('\n').at(-2),
        ]);
    });

    test('typescript mutation — a change to what loading a module does runs the dry run over every spec that loaded it', async () => {
        // Given - the consumer measured once at its label, then the label rewritten
        const result = await cli
            .fixture(directory('./__fixtures__/mutation-commands/'))
            .prepare((workdir) => {
                measuredOnce(workdir, 'src/labels.ts:1-1');
                writeFileSync(
                    join(workdir, 'src/labels.ts'),
                    "const LABEL = 'b' + 'ee';\n\nexport function labelOf(): string {\n    return LABEL;\n}\n",
                );
            })
            .env(OUTSIDE_CI)
            .exec('typescript mutation --mutate src/labels.ts:1-1');

        // Then - every spec spawned the command that loads the label, so each runs again
        expect(result.exitCode).toBe(0);
        expect(dryRunOf(result.stdout.text)).toBe(
            ' TYPESCRIPT  dry run: 4 of 4 test files the change reaches, on 1 worker(s)\n',
        );
    });

    test('typescript mutation — a change that leaves the record carrying every mutant of the suite, a compile error among them, starts no Stryker, and judges as a cold run does', async () => {
        // Given - the consumer, type-checked at command a, measured once at its body, then a source no test reaches added
        const result = await cli
            .fixture(directory('./__fixtures__/mutation-commands/'))
            .fixture(directory('./__fixtures__/mutation-carried/'))
            .prepare((workdir) => {
                measuredOnce(workdir, 'src/a.ts:1-3');
                unused(workdir);
            })
            .env(OUTSIDE_CI)
            .exec('typescript mutation --mutate src/a.ts:1-3');
        const cold = await cli
            .fixture(directory('./__fixtures__/mutation-commands/'))
            .fixture(directory('./__fixtures__/mutation-carried/'))
            .prepare(unused)
            .env({ TYPESCRIPT_CAPACITY: 'cpus=1,memory=64g' })
            .exec('typescript mutation --mutate src/a.ts:1-3');

        // Then - the kill and the compile error the compiler still refuses stand, so no dry run runs, and the verdict is the cold one
        expect([dryRunOf(result.stdout.text), dryRunOf(cold.stdout.text)]).toStrictEqual([
            " TYPESCRIPT  dry run: none, the record carries the stage's 2 mutant(s)\n",
            ' TYPESCRIPT  dry run: every test file, on 1 worker(s)\n',
        ]);
        expect(result.stdout.text).toContain('CompileError 1');
        expect([result.exitCode, result.stdout.text.split('\n').slice(-6)]).toStrictEqual([
            cold.exitCode,
            cold.stdout.text.split('\n').slice(-6),
        ]);
    });

    test('typescript mutation — a run asked for the HTML report starts Stryker though the record carries every mutant of the suite, and writes it', async () => {
        // Given - the consumer, type-checked, measured once at command a's body, then a source no test reaches added
        const result = await cli
            .fixture(directory('./__fixtures__/mutation-commands/'))
            .fixture(directory('./__fixtures__/mutation-carried/'))
            .prepare((workdir) => {
                measuredOnce(workdir, 'src/a.ts:1-3');
                unused(workdir);
            })
            .env(OUTSIDE_CI)
            .exec('typescript mutation --mutate src/a.ts:1-3 --report html');

        // Then - the dry run runs, and the report it was asked for is written
        expect(result.exitCode).toBe(0);
        expect(dryRunOf(result.stdout.text)).toBe(
            ' TYPESCRIPT  dry run: 1 of 4 test files the change reaches, on 1 worker(s)\n',
        );
        expect(result.file('.artifacts/stryker/suite-report.html').content).toContain(
            '<mutation-test-report-app',
        );
    });

    test('typescript mutation — Stryker runs only the source holding a mutant the record does not carry, its dry run over the spec that reaches it, and judges as a cold run does', async () => {
        // Given - the consumer, type-checked, measured once at command a's body and at the label's function, then that function rewritten to the same output
        const result = await cli
            .fixture(directory('./__fixtures__/mutation-commands/'))
            .fixture(directory('./__fixtures__/mutation-carried/'))
            .prepare((workdir) => {
                measuredOnce(workdir, 'src/a.ts:1-3,src/labels.ts:4-4');
                labelled(workdir);
            })
            .env(OUTSIDE_CI)
            .exec('typescript mutation --mutate src/a.ts:1-3,src/labels.ts:4-4');
        const cold = await cli
            .fixture(directory('./__fixtures__/mutation-commands/'))
            .fixture(directory('./__fixtures__/mutation-carried/'))
            .prepare(labelled)
            .env({ TYPESCRIPT_CAPACITY: 'cpus=1,memory=64g' })
            .exec('typescript mutation --mutate src/a.ts:1-3,src/labels.ts:4-4');

        // Then - a's kill and compile error stand, so Stryker is handed the label alone, run over the spec that ran it, and the verdict is the cold one
        expect(dryRunOf(result.stdout.text)).toBe(
            ' TYPESCRIPT  dry run: 1 of 4 test files the change reaches, on 1 worker(s)\n',
        );
        expect(
            JSON.parse(result.file('.artifacts/stryker/stryker.suite.config.json').content),
        ).toMatchObject({ mutate: ['src/labels.ts:4-4'] });
        expect([result.exitCode, result.stdout.text.split('\n').slice(-6)]).toStrictEqual([
            cold.exitCode,
            cold.stdout.text.split('\n').slice(-6),
        ]);
    });

    test('typescript mutation — the suite’s run states the files its dry run runs, and the module tests’ run states none', async () => {
        // Given - a consumer whose module test lets two mutants of its source live, so the whole suite measures them after it
        const result = await cli
            .fixture(directory('./__fixtures__/mutation-consumer/'))
            .env(OUTSIDE_CI)
            .exec('typescript mutation');

        // Then - both stages run, and one line names the test files of a dry run, the suite's
        expect(result.stdout.text).toContain('The module tests ran in');
        expect(
            result.stdout.text.match(/^.*dry run: (?:every test file|\d+ of \d+).*$/gmu),
        ).toStrictEqual([' TYPESCRIPT  dry run: every test file, on 1 worker(s)']);
    });

    test('typescript mutation — a process the dry run spawns compiles nothing through node’s compile cache, and one a mutant’s tests spawn compiles through it', async () => {
        // Given - a consumer whose spec spawns a command that asks for the compile cache and logs whether it got it, measured at its label
        const log = join(temporaryDirectory('compile-cache-'), 'runs.log');
        const result = await cli
            .fixture(directory('./__fixtures__/mutation-compile-cache/'))
            .env({ COMPILE_CACHE_LOG: log, TYPESCRIPT_CAPACITY: 'cpus=1,memory=64g' })
            .exec('typescript mutation --mutate src/label.ts:1-1');

        // Then - the dry run's process ran with the cache off, every mutant's with it on
        expect(result.exitCode).toBe(0);
        expect([...new Set(readFileSync(log, 'utf8').trim().split('\n'))].toSorted()).toStrictEqual(
            ['dry run: off', 'mutant: on'],
        );
    });
});
