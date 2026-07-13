import { describe, expect, test } from 'vitest';

import { tsgoSpec } from '../../../setup/tsgo.specification.js';

describe('typechecker', () => {
    test('passes for valid typed code', async () => {
        // Given — project with valid types
        const result = await tsgoSpec('valid types')
            .project('typechecker/valid')
            .exec('--noEmit')
            .run();

        // Then — no type errors
        expect(result.exitCode).toBe(0);
    });

    test('detects type errors', async () => {
        // Given — project with type mismatches
        const result = await tsgoSpec('invalid types')
            .project('typechecker/invalid')
            .exec('--noEmit')
            .run();

        // Then — type errors reported (tsgo exits with code 2 for type errors)
        expect(result.exitCode).not.toBe(0);
        expect(result.stdout).toContain('error TS');
    });
});
