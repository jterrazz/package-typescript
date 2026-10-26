import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { profilePath } from '../../__setup__/rulebook.js';
import { cli as oxlintCli } from '../oxlint.specification.js';

const NODE_CONFIG = profilePath('node');

describe('suite-settings', () => {
    test("leaves a suite's settings file its own `test`, the preset no vitest global names", async () => {
        // Given - a workspace suite's settings file listing the `test()` preset, fixed under the node profile
        const result = await oxlintCli
            .fixture(directory('./__fixtures__/suite-settings/'))
            .exec(`-c ${NODE_CONFIG} --fix specs/studio.config.ts`);

        // Then - no `import { test } from 'vitest'` was written over the preset's name
        expect(result.file('specs/studio.config.ts').content)
            .toBe(`import { test } from '@jterrazz/test/config';

export default { platform: 'node', presets: [test()] };
`);
    });
});
