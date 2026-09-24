import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { cli } from '../cli.specification.js';

/*
 * A chain, not a document. Both claims are the suppression gate's reading of
 * `oxlint --print-config`: a JS plugin's rules never reach that report, so a
 * directive naming one is never dead; and the report is resolved PER FILE, so
 * a rule the top level leaves off and an override arms is live inside the
 * files that override names, and dead outside them.
 *
 * Each config only ARMS rules — no root-only `options` key, no plugin named
 * `jterrazz` — so it is safe to commit: `typescript check` hands oxlint
 * files, never a directory, and never reads a config under the ground it
 * sits in ([Testing](../../../docs/03-testing.md)).
 */

/** The runner on `fixtures/suppressions-resolved-config/`, a config and a case laid over `project/`. */
const caseOf = (config: string, name: string) =>
    cli
        .fixture(directory('./fixtures/suppressions-resolved-config/project/'))
        .fixture(directory(`./fixtures/suppressions-resolved-config/${config}/`))
        .fixture(directory(`./fixtures/suppressions-resolved-config/${name}/`));

describe('suppressions-resolved-config', () => {
    test('leaves a directive on a JS plugin rule alone, allow entry or not', async () => {
        // Given - a directive on the plugin's live rule, suppressing a diagnostic oxlint really reports
        // When - the quality checks run there
        const result = await caseOf('js-plugin-config', 'js-plugin-live').exec('check');

        // Then - the gate says nothing about it, and the whole run is green
        expect(result.stdout.text).not.toContain('suppressions-dead');
        expect(result.exitCode).toBe(0);
    });

    test('still names a dead core rule in a project that loads a JS plugin', async () => {
        // Given - the same project, plus a directive on a core rule this config leaves off
        // When - the quality checks run there
        const result = await caseOf('js-plugin-config', 'js-plugin-dead-core-rule').exec('check');

        // Then - only the core rule is called dead, and the run fails on it
        expect(result.stdout.text).toContain(
            'suppressions-dead  index.ts  line 4 disables no-console, which the resolved config does not have on',
        );
        expect(result.stdout.text).not.toContain('demo/other');
        expect(result.exitCode).toBe(1);
    });

    test('leaves a directive alone where an override arms the rule it names', async () => {
        // Given - a rule the top level leaves off, armed for test files, and a directive in one
        // When - the quality checks run there
        const result = await caseOf('scoped-config', 'scoped-live').exec('check');

        // Then - the gate says nothing about it, and the whole run is green
        expect(result.stdout.text).not.toContain('suppressions-dead');
        expect(result.exitCode).toBe(0);
    });

    test('calls the same directive dead in a file the override does not name', async () => {
        // Given - that directive again, this time in a file no override reaches
        // When - the quality checks run there
        const result = await caseOf('scoped-config', 'scoped-dead').exec('check');

        // Then - it is named dead, and the run fails on it
        expect(result.stdout.text).toContain(
            'suppressions-dead  index.ts  line 1 disables no-var, which the resolved config does not have on',
        );
        expect(result.exitCode).toBe(1);
    });
});
