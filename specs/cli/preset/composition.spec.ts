import { directory } from '@jterrazz/test';
import { join, resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { cli as oxlintCli } from '../oxlint.specification.js';

const BUILT_FROM = resolve(import.meta.dirname, '../../..');

// A profile never auto-detects another @jterrazz package: the `test()` preset's rules exist only where it is listed.

const NODE_CONFIG = join(BUILT_FROM, 'dist/presets/oxlint/profiles/node.js');
const COMPOSED_CONFIG = resolve(import.meta.dirname, '_fixtures/composed.config.ts');

describe('composition', () => {
    test('enables the jterrazz rules when the consumer lists the test() preset', async () => {
        // Given - a probe spec linted with the config `fromPresets` builds from node and test()
        const result = await oxlintCli
            .fixture(directory('./_fixtures/enabled/'))
            .exec(`-c ${COMPOSED_CONFIG} probe.test.ts`);

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
