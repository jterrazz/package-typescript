import { directory } from '@jterrazz/test';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { onlyPasses } from '../__setup__/check-passes.js';
import { cli } from '../cli.specification.js';
import { formOnly } from './__setup__/oxlint-forms.js';

// outside: oxlint answers in its compact form whatever the machine's environment picks.
const oxlint = cli.with({ env: { ...formOnly({ AI_AGENT: 'spec' }), ...onlyPasses('oxlint') } });

describe('oxlint-config-unparsed', () => {
    test('fails the oxlint pass when the config names a JS plugin that is not there', async () => {
        // Given - a project whose oxlint config loads a plugin module nobody wrote — a config this repository cannot hold, since oxlint loads every config under it
        // When - the quality checks run there
        const result = await oxlint
            .fixture(directory('./__fixtures__/oxlint-config/plugin-missing/'))
            .prepare((workdir) => {
                writeFileSync(
                    join(workdir, 'oxlint.config.ts'),
                    'export default { jsPlugins: ["./nowhere.js"], rules: { "no-debugger": "error" } };\n',
                );
            })
            .exec('check');

        // Then - oxlint's own report is printed, and the pass names the refusal in its own vocabulary
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toMatch(`
             START  Running quality checks

             RUN  Oxlint Check

            Failed to parse oxlint configuration file.{{any}}
            oxlint-config-unparsed  oxlint.config.ts  found: oxlint refused this config and linted nothing — its own report is above · why: a run over a config oxlint could not parse enforces no rule, and would read as green · fix: repair what oxlint names above — usually a \`jsPlugins\` entry naming a module that is not there · read: docs/reference/quality-checks.md#the-two-refusals-that-are-not-diagnostics
            ✗ Failed with exit code 1 ({{duration}})

             END  Finalizing quality checks

            ✗ Some checks failed
        `);
    });

    test("fails the oxlint pass when oxlint lints nothing, in oxlint's own words", async () => {
        // Given - a project whose oxlint config ignores the one source file it has, so oxlint lints nothing
        // When - the quality checks run there
        const result = await oxlint
            .fixture(directory('./__fixtures__/oxlint-config/lints-nothing/'))
            .exec('check');

        // Then - oxlint says it found nothing to lint, and its exit fails the pass
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toMatch(`
             START  Running quality checks

             RUN  Oxlint Check

            No files found to lint. Please check your paths and ignore patterns.
            ✗ Failed with exit code 1 ({{duration}})

             END  Finalizing quality checks

            ✗ Some checks failed
        `);
    });
});
