import { expect, test } from 'vitest';

import { cli } from '../cli.specification.js';

/*
 * Routed through the product command: `typescript check` runs tsc (TypeScript 7)
 * as one of its four tools. grep is the scalpel — the `error TS` diagnostic is a
 * tsc-specific marker, so its presence/absence in the combined output proves the
 * type-checking behaviour without isolating the tool.
 */

test('passes for valid typed code', async () => {
    // Given - a project with valid types staged in the cwd
    const result = await cli.fixture('typechecker/valid/').exec('check');

    // Then - the TypeScript step reports no type errors
    expect(result.stdout).toContain('TypeScript Check');
    expect(result.stdout).not.toContain('error TS');
});

test('detects type errors', async () => {
    // Given - a project with type mismatches staged in the cwd
    const result = await cli.fixture('typechecker/invalid/').exec('check');

    // Then - type errors are reported by the TypeScript step
    expect(result.stdout).toContain('error TS');
});
