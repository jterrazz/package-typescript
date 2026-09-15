import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { cli as oxlintCli } from '../oxlint.specification.js';

/*
 * A chain, not a document: these two point oxlint at a profile directly (the
 * B9w exception oxlint.specification.ts states), and `literate()` binds every
 * `<case>.spec.yaml` of this repo to the product runner.
 *
 * The claim is about WIRING, not about a rule: a profile never auto-detects
 * another @jterrazz package, so the testing fragment's rules exist only where
 * a consumer composed it. Grep is the scalpel — one presence probe and one
 * absence probe, not a full-surface snapshot, which is resolved-config's.
 */

const NODE_CONFIG = resolve(import.meta.dirname, '../../../presets/oxlint/profiles/node.js');
const COMPOSED_CONFIG = resolve(import.meta.dirname, '_fixtures/composed.config.ts');

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
