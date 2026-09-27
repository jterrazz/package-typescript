import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { cli } from '../cli.specification.js';

// Each config only arms rules — no root-only `options`, no plugin named `jterrazz` — so it is safe to commit.

const caseOf = (config: string, name: string) =>
    cli
        .fixture(directory('./_fixtures/suppressions-resolved-config/project/'))
        .fixture(directory(`./_fixtures/suppressions-resolved-config/${config}/`))
        .fixture(directory(`./_fixtures/suppressions-resolved-config/${name}/`));

const REWRITTEN =
    "spells an eslint directive; this toolchain runs oxlint — 'typescript fix' rewrites it";

describe('suppressions-resolved-config', () => {
    test('rewrites an eslint directive on a JS plugin rule, allow entry or not', async () => {
        // Given - an eslint directive on the plugin's live rule, suppressing a diagnostic oxlint really reports
        // When - the quality checks run there
        const result = await caseOf('js-plugin-config', 'js-plugin-live').exec('check');

        // Then - the gate names the directive as one fix rewrites
        expect(result.stdout.text).toContain(
            `suppressions/spelled-for-this-toolchain  index.ts  line 1 ${REWRITTEN}`,
        );
        expect(result.exitCode).toBe(1);
    });

    test('keeps an eslint directive on a core rule the config leaves off, in a project that loads a JS plugin', async () => {
        // Given - the same project, plus an eslint directive on a core rule this config leaves off
        // When - the quality checks run there
        const result = await caseOf('js-plugin-config', 'js-plugin-dead-core-rule').exec('check');

        // Then - only the core rule's directive is left to its author, and the plugin rule's is rewritten
        expect(result.stdout.text).toContain(
            'suppressions/spelled-for-this-toolchain  index.ts  line 1 spells an eslint directive naming no-console, which this project does not run — name an oxlint rule',
        );
        expect(result.stdout.text).toContain(
            `suppressions/spelled-for-this-toolchain  index.ts  line 3 ${REWRITTEN}`,
        );
        expect(result.exitCode).toBe(1);
    });

    test('rewrites an eslint directive where an override arms the rule it names', async () => {
        // Given - a rule the top level leaves off, armed for test files, and an eslint directive in one
        // When - the quality checks run there
        const result = await caseOf('scoped-config', 'scoped-live').exec('check');

        // Then - the gate names the directive as one fix rewrites
        expect(result.stdout.text).toContain(
            `suppressions/spelled-for-this-toolchain  index.test.ts  line 1 ${REWRITTEN}`,
        );
        expect(result.exitCode).toBe(1);
    });

    test('keeps the same directive in a file the override does not name', async () => {
        // Given - that directive again, this time in a file no override reaches
        // When - the quality checks run there
        const result = await caseOf('scoped-config', 'scoped-dead').exec('check');

        // Then - it is left to its author, since no-var is not run there
        expect(result.stdout.text).toContain(
            'suppressions/spelled-for-this-toolchain  index.ts  line 1 spells an eslint directive naming no-var, which this project does not run — name an oxlint rule',
        );
        expect(result.exitCode).toBe(1);
    });
});
