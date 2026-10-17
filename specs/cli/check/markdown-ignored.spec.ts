import { directory } from '@jterrazz/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { onlyPasses } from '../__setup__/check-passes.js';
import { repository } from '../__setup__/repository.js';
import { cli } from '../cli.specification.js';

describe('markdown-ignored', () => {
    test('forgives a page naming a build product git ignores, and refuses one naming nothing', async () => {
        // Given - a repository whose README names a dist/ its .gitignore keeps out, and a page that never existed
        const result = await cli
            .with({ env: onlyPasses('markdown') })
            .fixture(directory('./__fixtures__/markdown/ignored-build/'))
            .prepare((workdir) => {
                mkdirSync(join(workdir, 'apps/web'), { recursive: true });
                repository(workdir);
            })
            .exec('check');

        // Then - only the path naming nothing is reported
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toMatch(`
             START  Running quality checks

             RUN  Markdown (prose)

            README.md:1:1: error markdown(path-resolves): \`apps/notes/absent.md\` names nothing on disk
            ✗ Failed with exit code 1 ({{duration}})

             END  Finalizing quality checks

            ✗ Some checks failed
        `);
    });
});
