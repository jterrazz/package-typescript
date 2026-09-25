import { directory } from '@jterrazz/test';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { cli as oxlintCli } from '../oxlint.specification.js';

// `testing` composes after the profile and an override replaces options, so its options win (ADR-008).
// `fixtures/vitest-rule-owner.config.ts` stands in for it; one rule proves the precedence all three share.

const NODE_CONFIG = resolve(import.meta.dirname, '../../../src/presets/oxlint/profiles/node.js');
const OWNER_CONFIG = resolve(import.meta.dirname, 'fixtures/vitest-rule-owner.config.ts');

describe('covered-by-testing', () => {
    test('the bare profile stays silent — covered, its options owed elsewhere', async () => {
        // Given - a snapshot matcher linted under the bare node profile alone
        const result = await oxlintCli
            .fixture(directory('./fixtures/covered-vitest-rules/'))
            .exec(`-c ${NODE_CONFIG} probe.test.ts`);

        // Then - no rule fires: the profile turned it off, not this file
        expect(result.stdout.text).not.toContain('no-restricted-matchers');
    });

    test('the fragment that took the rule over decides the file', async () => {
        // Given - the same file, this time with the owning fragment composed after the profile
        const result = await oxlintCli
            .fixture(directory('./fixtures/covered-vitest-rules/'))
            .exec(`-c ${OWNER_CONFIG} probe.test.ts`);

        // Then - the option-carrying override fires, because it composes last
        expect(result.stdout.grep('probe.test.ts').text).toContain('no-restricted-matchers');
    });
});
