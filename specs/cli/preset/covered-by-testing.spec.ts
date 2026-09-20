import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { cli as oxlintCli } from '../oxlint.specification.js';

/*
 * ADR-008: `vitest/no-restricted-matchers`, `vitest/no-restricted-vi-methods`
 * and `vitest/max-nested-describe` turn `covered` in 10.3.0 — this rulebook
 * lets go of the option-less copy because `@jterrazz/test` 16.0's `testing`
 * fragment sets the same three WITH the options this vocabulary owns, and
 * composes AFTER the profile, so its options win (an override REPLACES, it
 * never merges).
 *
 * This suite proves that contract with one rule, `no-restricted-matchers`,
 * standing in for the other two — the mechanism is the same override
 * precedence for all three, and `rule-surface.test.ts` already proves every
 * `off` here names one of the five recorded reasons. It cannot reach for
 * `@jterrazz/test` 16.0 itself: that fragment is not released, and this
 * package cannot depend on an unreleased version of a package that already
 * depends on it. `_fixtures/vitest-rule-owner.config.ts` stands in for it.
 */

const NODE_CONFIG = resolve(import.meta.dirname, '../../../presets/oxlint/profiles/node.js');
const OWNER_CONFIG = resolve(import.meta.dirname, '_fixtures/vitest-rule-owner.config.ts');

describe('a rule marked covered answers to whichever fragment composes it', () => {
    test('the bare profile stays silent — covered, its options owed elsewhere', async () => {
        // Given - a snapshot matcher linted under the bare node profile alone
        const result = await oxlintCli
            .fixture('covered-vitest-rules/')
            .exec(`-c ${NODE_CONFIG} probe.test.ts`);

        // Then - no rule fires: the profile turned it off, not this file
        expect(result.stdout).not.toContain('no-restricted-matchers');
    });

    test('the fragment that took the rule over decides the file', async () => {
        // Given - the same file, this time with the owning fragment composed after the profile
        const result = await oxlintCli
            .fixture('covered-vitest-rules/')
            .exec(`-c ${OWNER_CONFIG} probe.test.ts`);

        // Then - the option-carrying override fires, because it composes last
        expect(result.stdout.grep('probe.test.ts')).toContain('no-restricted-matchers');
    });
});
