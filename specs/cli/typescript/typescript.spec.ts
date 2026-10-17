import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { cli } from '../packed-cli.specification.js';

describe('typescript', () => {
    test('the bin npm links from the install checks a consumer project that keeps every rule', async () => {
        // Given - a consumer api declared on node, its editor files the ones its declaration derives
        const result = await cli
            .fixture(directory('./__fixtures__/project/'))
            .exec('typescript check');

        // Then - every pass runs from the install and passes, and the drift report reads the declaration
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(`
             START  Running quality checks

             RUN  Config (one file)

            ✓ Passed ({{duration}})

             RUN  TypeScript Check

            ✓ Passed ({{duration}})

             RUN  Oxlint Check

            ✓ Passed ({{duration}})

             RUN  Oxfmt Check

            ✓ Passed ({{duration}})

             RUN  Gitignore (artefacts)

            ✓ Passed ({{duration}})

             RUN  Knip (unused code)

            ✓ Passed ({{duration}})

             RUN  Architecture (layer map)

            ✓ Passed ({{duration}})

             RUN  Suppressions (directives)

            ✓ Passed ({{duration}})

             RUN  Markdown (prose)

            ✓ Passed ({{duration}})

             RUN  Names (tree)

            ✓ Passed ({{duration}})

             RUN  Secrets (credentials)

            ✓ Passed ({{duration}})

             DRIFT  Deviations from the profile

              declared                              api on node
              exceptions                            0
              rules off vs profile                  none
              suppressions                          0
              .jterrazz/oxlint-suppressions.json    nothing held
              .jterrazz/baseline.json › typescript  nothing held
              tool versions                         in range

             END  Finalizing quality checks

            ✓ All checks passed
        `);
    });

    test('the bin npm links from the install fixes what the profile and the format preset rewrite', async () => {
        // Given - the same project, its module breaking a rule the profile fixes and the preset's format
        const result = await cli
            .fixture(directory('./__fixtures__/project/'))
            .fixture(directory('./__fixtures__/misformatted/'))
            .exec('typescript fix');

        // Then - every fixing pass runs from the install and passes, and the module is rewritten as the profile and the preset write it
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(`
             START  Running quality fixes

             RUN  Config (one file)

            ✓ Passed ({{duration}})

             RUN  TypeScript Check

            ✓ Passed ({{duration}})

             RUN  Oxlint Fix

            ✓ Passed ({{duration}})

             RUN  Oxfmt Format

            ✓ Passed ({{duration}})

             RUN  Gitignore (artefacts)

            ✓ Passed ({{duration}})

             RUN  Architecture (layer map)

            ✓ Passed ({{duration}})

             RUN  Suppressions (directives)

            ✓ Passed ({{duration}})

             RUN  Markdown (prose)

            ✓ Passed ({{duration}})

             RUN  Names (tree)

            ✓ Passed ({{duration}})

             END  Finalizing quality fixes

            ✓ All checks passed
        `);
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
