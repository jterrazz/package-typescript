import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { profilePath } from '../../_shared/_setup/rulebook.js';
import { cli as oxlintCli } from '../oxlint.specification.js';

// outside: the `test()` preset's oxlint composes after the profile and an override replaces options, so its options win (ADR-008).
// `_fixtures/owning-preset/` stands in for it; one rule proves the precedence all three share.

const NODE_CONFIG = profilePath('node');

describe('covered-by-testing', () => {
    test('the bare profile stays silent — covered, its options owed elsewhere', async () => {
        // Given - a snapshot matcher linted under the bare node profile alone
        const result = await oxlintCli
            .fixture(directory('./_fixtures/covered-vitest-rules/'))
            .exec(`-c ${NODE_CONFIG} probe.test.ts`);

        // Then - no rule fires: the profile turned it off, not this file
        expect(result.stdout.text).not.toContain('no-restricted-matchers');
    });

    test('the fragment that took the rule over decides the file', async () => {
        // Given - the same file, in a project whose settings list a preset owning the rule, its config derived from them
        const result = await oxlintCli
            .fixture(directory('./_fixtures/covered-vitest-rules/'))
            .fixture(directory('./_fixtures/owning-preset/'))
            .exec('probe.test.ts');

        // Then - the option-carrying override fires, because it composes last
        expect(result.stdout.grep('probe.test.ts').text).toContain('no-restricted-matchers');
    });
});
