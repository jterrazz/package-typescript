import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { cli as oxlintCli } from '../oxlint.specification.js';
import { profilePath } from './_setup/rulebook.js';

// invariant: a profile never auto-detects another @jterrazz package: the `test()` preset's rules exist only where it is listed.

const NODE_CONFIG = profilePath('node');

describe('composition', () => {
    test('enables the jterrazz rules when the consumer lists the test() preset', async () => {
        // Given - a probe spec in a project whose settings list test(), its oxlint config derived from them
        const result = await oxlintCli
            .fixture(directory('./_fixtures/enabled/'))
            .fixture(directory('./_fixtures/declaring-test/'))
            .link('@jterrazz/test')
            .exec('probe.test.ts');

        // Then - a jterrazz convention rule fires on the probe spec
        expect(result.stdout.grep('probe.test.ts').text).toContain(
            'given-and-then-markers-present',
        );
    });

    test('stays silent when the consumer does not list test()', async () => {
        // Given - the same probe linted with the bare node profile
        const result = await oxlintCli
            .fixture(directory('./_fixtures/enabled/'))
            .exec(`-c ${NODE_CONFIG} probe.test.ts`);

        // Then - no jterrazz rule is registered: wiring is explicit, never auto-detected
        expect(result.stdout.text).not.toContain('jterrazz');
    });
});
