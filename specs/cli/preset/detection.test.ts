import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { cli } from '../cli.specification.js';
import { cli as oxlintCli } from '../oxlint.specification.js';

/*
 * Grep is the scalpel here: each test is a targeted presence/absence probe for one
 * behavioural flag (a rule id fires, a pipeline step chains, a warning is emitted),
 * not a full-surface snapshot of the check output.
 */

const NODE_CONFIG = resolve(import.meta.dirname, '../../../presets/oxlint/node.js');
const COMPOSED_CONFIG = resolve(import.meta.dirname, 'fixtures/composed.config.ts');

describe('composable presets (explicit wiring)', () => {
    test('enables the jterrazz rules when the consumer composes the testing fragment', async () => {
        // Given - a probe spec linted with a config that composes node + testing
        const result = await oxlintCli
            .fixture('enabled/')
            .exec(`-c ${COMPOSED_CONFIG} probe.test.ts`);

        // Then - a jterrazz convention rule fires on the probe spec
        expect(result.stdout.grep('probe.test.ts')).toContain('b4-given-then');
    });

    test('stays silent when the consumer does not compose testing', async () => {
        // Given - the same probe linted with the bare node preset (no testing fragment)
        const result = await oxlintCli.fixture('enabled/').exec(`-c ${NODE_CONFIG} probe.test.ts`);

        // Then - no jterrazz rule is registered: wiring is explicit, never auto-detected
        expect(result.stdout).not.toContain('jterrazz');
    });
});

describe('conventions checker chaining (orchestration detection)', () => {
    test('chains the checker on specs when the project depends on @jterrazz/test', async () => {
        // Given - typescript check in a project with @jterrazz/test and a specs directory
        const result = await cli.fixture('enabled/').exec('check');

        // Then - the Test Conventions step runs (a runner decision, not config identity)
        expect(result.stdout).toContain('Test Conventions');
    });

    test('skips the checker when the project does not depend on @jterrazz/test', async () => {
        // Given - typescript check in a project without @jterrazz/test
        const result = await cli.fixture('disabled/').exec('check');

        // Then - the Test Conventions step does not run
        expect(result.stdout).not.toContain('Test Conventions');
    });
});

describe('commonjs config pitfall', () => {
    test('warns loudly when @jterrazz/test meets a CommonJS oxlint config', async () => {
        // Given - typescript check in a project with @jterrazz/test and a CJS oxlint config
        const result = await cli.fixture('cjs-config/').exec('check');

        // Then - the ESM-only plugin pitfall is surfaced loudly
        expect(result.stdout).toContain('SILENTLY DROPPED');
    });
});
