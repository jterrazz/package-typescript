import { directory } from '@jterrazz/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { onlyPasses } from '../__setup__/check-passes.js';
import { git } from '../__setup__/repository.js';
import { cli } from '../cli.specification.js';

describe('committed-artefact', () => {
    test('fails a repository that has committed an artefact', async () => {
        // Given - a project on the convention, in a repository whose index tracks a buildinfo its .gitignore excludes
        const result = await cli
            .with({ env: onlyPasses('gitignore') })
            .fixture(directory('./__fixtures__/gitignore/on-convention/'))
            .prepare((workdir) => {
                writeFileSync(join(workdir, 'tsconfig.tsbuildinfo'), '{"version":"stale"}\n');
                git(workdir, 'init', '--quiet');
                git(workdir, 'add', '--force', 'tsconfig.tsbuildinfo');
            })
            .exec('check');

        // Then - the gate names the committed artefact and how to untrack it
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toMatch(`
             START  Running quality checks

             RUN  Gitignore (artefacts)

            Artefacts must never be committed:
              ✗ tsconfig.tsbuildinfo is tracked — git rm --cached tsconfig.tsbuildinfo
            ✗ Failed with exit code 1 ({{duration}})

             END  Finalizing quality checks

            ✗ Some checks failed
        `);
    });

    test('fails a repository that has committed a file under .turbo/, though ignoring the folder is granted', async () => {
        // Given - a project whose ignored .turbo/ is allowed, with one of its logs tracked
        const result = await cli
            .with({ env: onlyPasses('gitignore') })
            .fixture(directory('./__fixtures__/gitignore/turbo/'))
            .prepare((workdir) => {
                mkdirSync(join(workdir, '.turbo'));
                writeFileSync(join(workdir, '.turbo/turbo-build.log'), 'cache miss\n');
                git(workdir, 'init', '--quiet');
                git(workdir, 'add', '--force', '.turbo/turbo-build.log');
            })
            .exec('check');

        // Then - the gate names the tracked log, and never asks for .turbo/ to move
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toMatch(`
             START  Running quality checks

             RUN  Gitignore (artefacts)

            Artefacts must never be committed:
              ✗ .turbo/turbo-build.log is tracked — git rm --cached .turbo/turbo-build.log
            ✗ Failed with exit code 1 ({{duration}})

             END  Finalizing quality checks

            ✗ Some checks failed
        `);
    });
});
