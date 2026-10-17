import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { onlyPasses } from '../__setup__/check-passes.js';
import { repository } from '../__setup__/repository.js';
import { cli } from '../cli.specification.js';

const SIGNED = '# An article   \n\n* first point\n+ second point\n';

describe('markdown-content-kept', () => {
    test('neither judges nor rewrites a page of a content tree or of a root a script writes', async () => {
        // Given - a repository whose assets/ holds an article and whose declared generated root holds a report, both pages rumdl would rewrite, beside a clean README
        const result = await cli
            .with({ env: onlyPasses('markdown') })
            .fixture(directory('./__fixtures__/markdown/content-kept/'))
            .prepare(repository)
            .exec(['fix', 'check']);

        // Then - the check passes, and both pages keep every byte the fix found
        expect(result.exitCode).toBe(0);
        expect([
            result.file('assets/article/en.md').content,
            result.file('reports/week.md').content,
        ]).toStrictEqual([SIGNED, SIGNED]);
    });

    test("keeps a workspace member's content trees and the roots its own settings name a script writes", async () => {
        // Given - a workspace whose member keeps a page under public/ and one under a generated root only it declares
        const result = await cli
            .with({ env: onlyPasses('markdown') })
            .fixture(directory('./__fixtures__/markdown/content-kept-workspace/'))
            .prepare(repository)
            .exec(['fix', 'check']);

        // Then - the check passes, and both pages keep every byte
        expect(result.exitCode).toBe(0);
        expect([
            result.file('apps/site/public/notes.md').content,
            result.file('apps/site/reports/week.md').content,
        ]).toStrictEqual([SIGNED, SIGNED]);
    });
});
