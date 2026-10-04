import { directory } from '@jterrazz/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { onlyPasses } from '../_setup/check-passes.js';
import { cli } from '../cli.specification.js';

describe('knip-tool-cache', () => {
    test('loads a TypeScript config and leaves no transpiled copy of it under node_modules/', async () => {
        // Given - a project whose vitest.config.ts knip reads, and a node_modules/ a loader would cache into
        const result = await cli
            .with({ env: onlyPasses('knip') })
            .fixture(directory('./_fixtures/knip/typescript-config/'))
            .prepare((workdir) => {
                mkdirSync(join(workdir, 'node_modules'));
            })
            .exec('check');

        // Then - the pass judged it, and no tool cache was written outside .artifacts/
        expect(result.exitCode).toBe(0);
        expect(result.file('node_modules/.cache').exists).toBe(false);
    });
});
