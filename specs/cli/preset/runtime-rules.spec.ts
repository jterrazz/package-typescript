import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { profilePath } from '../../__setup__/rulebook.js';
import { cli as oxlintCli } from '../oxlint.specification.js';

describe('runtime-rules', () => {
    test('matchAll given a named group is refused on expo, where Hermes drops the groups, and not on node', async () => {
        // Given - a module reading matchAll with a named group written in the call and held by a const, and a named group read with exec
        const fixture = oxlintCli.fixture(directory('./__fixtures__/runtime-rules/'));

        // When - it is linted under the expo profile, then under node's
        const expo = await fixture.exec(`-c ${profilePath('expo')} pairs.ts`);
        const node = await fixture.exec(`-c ${profilePath('node')} pairs.ts`);

        // Then - the pattern in the call and the one a const holds are refused with their lesson on expo, and node reports none
        expect(expo.exitCode).toBe(1);
        expect(expo.stdout.grep('no-named-groups-in-match-all')).toMatch(`
            pairs.ts:3:45: error jterrazz-typescript(no-named-groups-in-match-all): found: \`matchAll\` is given a pattern with a named group, whose \`match.groups\` Hermes leaves undefined · why: Hermes, the engine an Expo app runs on, drops the named groups of the matches \`String#matchAll\` yields: \`match.groups\` is \`undefined\` at runtime, and the type check and every test on Node read them as the specification says · fix: read the groups of each match with \`exec\` in a loop on a global pattern, or by position (\`match[1]\`) where the iterator is wanted; a pattern without a named group is read by \`matchAll\` as usual · read: docs/reference/lint-presets.md#matchall-keeps-no-named-group-on-hermes
            pairs.ts:5:43: error jterrazz-typescript(no-named-groups-in-match-all): found: \`matchAll\` is given a pattern with a named group, whose \`match.groups\` Hermes leaves undefined · why: Hermes, the engine an Expo app runs on, drops the named groups of the matches \`String#matchAll\` yields: \`match.groups\` is \`undefined\` at runtime, and the type check and every test on Node read them as the specification says · fix: read the groups of each match with \`exec\` in a loop on a global pattern, or by position (\`match[1]\`) where the iterator is wanted; a pattern without a named group is read by \`matchAll\` as usual · read: docs/reference/lint-presets.md#matchall-keeps-no-named-group-on-hermes
        `);
        expect(node.stdout.grep('no-named-groups-in-match-all')).toMatch('');
    });
});
