import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { cli } from '../packed-cli.specification.js';

describe('typescript', () => {
    test('the bin npm links from the install checks a consumer project that keeps every rule', async () => {
        // Given - a consumer's project on the node profile, its two configs written as the manual writes them
        const result = await cli
            .fixture(directory('./_fixtures/project/'))
            .exec('typescript check');

        // Then - every pass runs from the install and passes, and the drift report reads the profile the config names
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(`
             START  Running quality checks

             RUN  TypeScript Check

            ✓ Passed

             RUN  Oxlint Check

            ✓ Passed

             RUN  Oxfmt Check

            ✓ Passed

             RUN  Gitignore (artefacts)

            ✓ Passed

             RUN  Knip (unused code)

            ✓ Passed

             RUN  Suppressions (directives)

            ✓ Passed

             RUN  Markdown (prose)

            ✓ Passed

             RUN  Names (tree)

            ✓ Passed

             RUN  Comments (density)

            ✓ Passed

             RUN  Secrets (credentials)

            ✓ Passed

             DRIFT  Deviations from the profile

              profile                              node
              rules off vs profile                 none
              suppressions                         0
              oxlint-suppressions.json             nothing held
              jterrazz.baseline.json › typescript  nothing held
              tool versions                        in range

             END  Finalizing quality checks

            ✓ All checks passed
        `);
    });

    test('the bin npm links from the install fixes what the profile and the format preset rewrite', async () => {
        // Given - the same project, its module breaking a rule the profile fixes and the preset's format
        const result = await cli
            .fixture(directory('./_fixtures/project/'))
            .fixture(directory('./_fixtures/misformatted/'))
            .exec('typescript fix');

        // Then - the fix run passes, and the module is rewritten as the profile and the preset write it
        expect(result.exitCode).toBe(0);
        expect(result.stdout.text).toContain('✓ All checks passed');
        expect(result.file('src/index.ts').content).toBe(
            [
                'export function shout(text: string): string {',
                '    const loud = text.toUpperCase();',
                '    return loud.trim();',
                '}',
                '',
            ].join('\n'),
        );
    });
});
