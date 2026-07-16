import { describe, expect, test } from 'vitest';

import { tscSpec } from '../../../setup/tsc.specification.js';

describe('typechecker', () => {
    test('passes for valid typed code', async () => {
        // Given — project with valid types
        const result = await tscSpec('valid types')
            .project('typechecker/valid')
            .exec('--noEmit')
            .run();

        // Then — no type errors
        expect(result.exitCode).toBe(0);
    });

    test('detects type errors', async () => {
        // Given — project with type mismatches
        const result = await tscSpec('invalid types')
            .project('typechecker/invalid')
            .exec('--noEmit')
            .run();

        // Then — type errors reported (tsc exits non-zero for type errors)
        expect(result.exitCode).not.toBe(0);
        result.stdout.toContain('error TS');
    });
});
