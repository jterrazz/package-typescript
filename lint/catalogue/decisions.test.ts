import { describe, expect, test } from 'vitest';

import { decisions } from './decisions.js';

describe('decisions', () => {
    test('every decision carries the version it was taken in', () => {
        // Given - the whole catalogue
        const entries = decisions();
        expect(entries.length).toBeGreaterThan(500);

        // Then - each one names a semver, which is what replaces a changelog here
        for (const entry of entries) {
            expect.soft(entry.since, `${entry.rule} has no since`).toMatch(/^\d+\.\d+\.\d+$/u);
        }
    });
});
