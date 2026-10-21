import { directory } from '@jterrazz/test';
import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import type { CheckPass } from '#command';

import { onlyPasses, SELECTING_BIN } from '../__setup__/check-passes.js';
import { repository } from '../__setup__/repository.js';
import { cli } from '../cli.specification.js';

// invariant: the first check is the command the chain runs, in the same environment but for the passes it names, so a second run differs from it by the selection alone; its verdict file is removed, so a hit is seen writing it again.
function checkedGreen(...passes: [CheckPass, ...CheckPass[]]): (workdir: string) => void {
    return (workdir) => {
        repository(workdir);
        execFileSync('node', [SELECTING_BIN, 'check'], {
            cwd: workdir,
            env: { ...process.env, ...onlyPasses(...passes) },
            stdio: 'pipe',
        });
        rmSync(join(workdir, '.artifacts/gate/verdict.json'));
    };
}

describe('proven', () => {
    test('answers a check of a tree already checked green from its proof: nothing runs, and the verdict file is written again', async () => {
        // Given - a repository on the convention, checked green once by the same passes
        const result = await cli
            .with({ env: onlyPasses('gitignore') })
            .fixture(directory('./__fixtures__/gitignore/on-convention/'))
            .prepare(checkedGreen('gitignore'))
            .exec('check');

        // Then - the run prints the proof it stands on and no pass, and the verdict file holds the green again
        expect(result.exitCode).toBe(0);
        expect(result.stdout.text).toMatch(
            /^ TYPESCRIPT {2}✓ Proven green: this tree passed `typescript check` at \S+ on .+, and no input of its key changed since \(\.artifacts\/proven\/check-[\da-f]{12}…\); nothing ran, and --cold runs it again\n$/u,
        );
        expect(result.file('.artifacts/gate/verdict.json').content).toContain('"status": 0');
    });

    test('runs a check whose passes differ from the green its tree holds', async () => {
        // Given - the same repository, checked green by one pass, then checked by two
        const result = await cli
            .with({ env: onlyPasses('gitignore', 'secrets') })
            .fixture(directory('./__fixtures__/gitignore/on-convention/'))
            .prepare(checkedGreen('gitignore'))
            .exec('check');

        // Then - the selection is in the key, so both passes run
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(`
             START  Running quality checks

             RUN  Gitignore (artefacts)

            ✓ Passed ({{duration}})

             RUN  Secrets (credentials)

            ✓ Passed ({{duration}})

             END  Finalizing quality checks

            ✓ All checks passed
        `);
    });

    test('runs every pass again when asked cold, though the tree is proven green', async () => {
        // Given - the same repository, checked green once
        const result = await cli
            .with({ env: onlyPasses('gitignore') })
            .fixture(directory('./__fixtures__/gitignore/on-convention/'))
            .prepare(checkedGreen('gitignore'))
            .exec('check --cold');

        // Then - the cold run is the whole run
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(`
             START  Running quality checks

             RUN  Gitignore (artefacts)

            ✓ Passed ({{duration}})

             END  Finalizing quality checks

            ✓ All checks passed
        `);
    });

    test('prints the drift report every time it is asked as JSON, though the tree is proven green', async () => {
        // Given - the same repository, its drift asked as JSON twice
        const result = await cli
            .with({ env: onlyPasses('gitignore', 'drift') })
            .fixture(directory('./__fixtures__/gitignore/on-convention/'))
            .prepare(repository)
            .exec(['check --json', 'check --json']);

        // Then - the second run is a run, its report printed
        expect(result.exitCode).toBe(0);
        expect(result.stdout.text).not.toContain('Proven green');
        expect(result.stdout.text).toContain('DRIFT');
    });
});
