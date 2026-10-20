import { directory } from '@jterrazz/test';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { cli } from '../packed-cli.specification.js';

const CONSUMER = resolve(import.meta.dirname, '../__setup__/packed/consumer.ts');

const OUTSIDE_CI = { CI: '', TYPESCRIPT_JOBS: '1' };

// invariant: the first run is the packed command the second one runs, in a repository git can list, outside CI and with no cold run asked, so the second reads its record.
function measuredOnce(workdir: string, range: string): void {
    execFileSync('git', ['init', '--quiet'], { cwd: workdir });
    execFileSync('node', [CONSUMER, 'typescript', 'mutation', '--mutate', range], {
        cwd: workdir,
        env: { ...process.env, ...OUTSIDE_CI },
        stdio: 'pipe',
    });
}

const dryRunOf = (text: string): string | undefined => /dry run: .*\n/u.exec(text)?.[0];

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
            .env({ TYPESCRIPT_JOBS: '1' })
            .exec('typescript mutation --mutate src/b.ts:4-4');

        // Then - the specs that only load b.ts sit the dry run out, and the verdict is the cold one
        expect([dryRunOf(result.stdout.text), dryRunOf(cold.stdout.text)]).toStrictEqual([
            'dry run: 1 of 4 test files the change reaches, on 1 worker(s)\n',
            'dry run: every test file, on 1 worker(s)\n',
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
                    "const LABEL = 'bee' as const;\n\nexport function labelOf(): string {\n    return LABEL;\n}\n",
                );
            })
            .env(OUTSIDE_CI)
            .exec('typescript mutation --mutate src/labels.ts:1-1');

        // Then - every spec spawned the command that loads the label, so each runs again
        expect(result.exitCode).toBe(0);
        expect(dryRunOf(result.stdout.text)).toBe(
            'dry run: 4 of 4 test files the change reaches, on 1 worker(s)\n',
        );
    });
});
