import { describe, expect, test } from 'vitest';

import { objectOf } from '../../../kit/project/json.js';
import { cruiseConfig } from '../architecture.js';

const excludedBy = (path: string): boolean => {
    const { options } = objectOf(cruiseConfig([], { exists: () => false, root: '/project' }));
    const { path: pattern } = objectOf(objectOf(options).exclude);

    return new RegExp(String(pattern), 'u').test(path);
};

describe('architecture', () => {
    test('cruiseConfig — leaves out the ground of a test and the output of a run, at the root and below it, and no folder that merely resembles them', () => {
        // Given - paths of the ground folders, of `.artifacts/` at the root and in a member, and look-alikes
        const paths = [
            'specs/cli/__fixtures__/a/b.ts',
            'src/__expected__/out.ts',
            '.artifacts/vitest/deps-chunk.js',
            'apps/api/.artifacts/stryker/tmp/a.ts',
            'src/artifacts/a.ts',
            'src/not.artifacts/a.ts',
            'src/fixtures/a.ts',
        ];

        // Then - the first four are left out of the cruise, the look-alikes are cruised
        expect(paths.map((path) => excludedBy(path))).toStrictEqual([
            true,
            true,
            true,
            true,
            false,
            false,
            false,
        ]);
    });
});
