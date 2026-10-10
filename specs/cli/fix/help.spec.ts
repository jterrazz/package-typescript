import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { MISFORMATTED, sweptRepository } from '../__setup__/format-sweep.js';
import { cli } from '../cli.specification.js';

describe('help', () => {
    test('prints the usage of fix and rewrites no file, where the same tree under fix is rewritten', async () => {
        // Given - the repository whose tracked and new source files fix formats (format-sweep)
        // When - fix is asked for its help, every pass selected
        const result = await cli
            .fixture(directory('../__fixtures__/format-sweep/misformatted/'))
            .prepare(sweptRepository(MISFORMATTED))
            .exec('fix --help');

        // Then - the usage, exit 0, and both source files as they were, no artefact written
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(`
             TYPESCRIPT  TypeScript toolchain

            Usage: typescript fix

            Auto-fix lint and formatting issues

            Flags:
              -h, --help  Print this help and run nothing

            Read: docs/reference/quality-checks.md#flags-and-exit-codes
        `);
        expect([
            result.file('src/index.ts').content,
            result.file('src/added.ts').content,
            result.file('.artifacts').exists,
        ]).toStrictEqual([MISFORMATTED, MISFORMATTED, false]);
    });
});
