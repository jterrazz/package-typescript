import { describe, expect, test } from 'vitest';

import { PACKAGE_ROOT, resolutionSpec } from '../../../setup/resolution.specification.js';

describe('check binary resolution', () => {
    test('resolves each tool independently when npm splits them between bin dirs', async () => {
        // Given — oxlint nested under the package, the other tools hoisted to the consumer root
        const result = await resolutionSpec('split install').exec(PACKAGE_ROOT).run();

        // Then — every tool is found and runs, wherever npm placed it
        expect(result.exitCode).toBe(0);
        result.stdout.toContain('tsgo-stub-ran');
        result.stdout.toContain('oxlint-stub-ran');
        result.stdout.toContain('oxfmt-stub-ran');
        result.stdout.toContain('knip-stub-ran');
        result.stdout.toContain('All checks passed');
    });
});
