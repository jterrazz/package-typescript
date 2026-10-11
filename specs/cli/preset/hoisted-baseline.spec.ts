import { describe, expect, test } from 'vitest';

import { cli } from '../hoisted-baseline.specification.js';

describe('hoisted-baseline', () => {
    test('records the linter debt of a workspace member with the oxlint hoisted to the root', async () => {
        // Given - a member whose toolchain and tools are hoisted beside the workspace root, the PATH holding none
        // When - the member records its baseline
        const result = await cli.exec();

        // Then - the oxlint beside the package is the one that ran, as the check resolves it
        expect(result.stdout.text).toBe('oxlint resolved beside the workspace root: yes\n');
    }, 60_000);
});
