import { directory } from '@jterrazz/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { onlyPasses } from '../__setup__/check-passes.js';
import { repository } from '../__setup__/repository.js';
import { cli } from '../cli.specification.js';

// invariant: the ground cannot be a fixture: a file the fixture's own nested .gitignore keeps out is one git never tracks.
function clonedUnderWork(workdir: string): void {
    mkdirSync(join(workdir, 'work/repos/clone/src'), { recursive: true });
    writeFileSync(join(workdir, 'work/repos/clone/src/orphan.ts'), 'export const orphan = 1;\n');
}

describe('knip-nested-gitignore', () => {
    test('leaves out a folder a nested .gitignore outside every member keeps out, and still finds what a member leaves unused', async () => {
        // Given - a monorepo whose work/.gitignore, in no member, ignores a clone holding a module nothing imports, and a member with a file nothing reaches
        const result = await cli
            .with({ env: onlyPasses('knip') })
            .fixture(directory('./__fixtures__/knip/nested-gitignore/'))
            .prepare(clonedUnderWork)
            .prepare(repository)
            .exec('check');

        // Then - the member's file alone is reported, never the ignored clone's
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toMatch(`
             START  Running quality checks

             RUN  Knip (unused code)

            Unused files (1)
            packages/lib/src/forgotten.ts
            ✗ Failed with exit code 1 ({{duration}})

             END  Finalizing quality checks

            ✗ Some checks failed, first Knip (unused code): Unused files (1)
        `);
    });
});
