import { describe, expect, test } from 'vitest';

import { cli } from '../hoisted-baseline.specification.js';

describe('hoisted-baseline', () => {
    test('records and judges a workspace member with the tools hoisted to the root', async () => {
        // Given - a member whose toolchain and tools are hoisted beside the workspace root, the PATH holding none
        // When - the member records its baseline, then the workspace root records its own and runs the check
        const result = await cli.exec();

        // Then - the oxlint and the dependency-cruiser beside the package are the ones that ran, as the check resolves them
        expect(result.stdout.text).toBe(
            [
                'oxlint resolved beside the workspace root: yes',
                "dependency-cruiser resolved beside the workspace root for a member's baseline: yes",
                "dependency-cruiser resolved beside the workspace root for a member's check: yes",
                '',
            ].join('\n'),
        );
    }, 120_000);
});
