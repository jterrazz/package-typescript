import { describe, expect, test } from 'vitest';

import { UNCRUISED_PATHS } from '../../../kit/project/ground.js';
import { uncruisedOf } from '../architecture.units.js';

describe('architecture.units', () => {
    test('uncruisedOf — a unit holding no member leaves out the ground and the run output alone', () => {
        // Given - a unit with no workspace member
        // Then - the paths are the shared ones, nothing appended
        expect(uncruisedOf([])).toBe(UNCRUISED_PATHS);
    });

    test('uncruisedOf — each member is one alternative of a folder opening the path', () => {
        // Given - two members
        // Then - the ground first, then the members as the alternatives of one group
        expect(uncruisedOf(['apps/web', 'packages/ui'])).toBe(
            `${UNCRUISED_PATHS}|^(apps/web|packages/ui)/`,
        );
    });

    test('uncruisedOf — a member name is matched literally, whatever character it holds', () => {
        // Given - a member whose name holds every character a pattern reads as syntax
        const member = String.raw`a.b+c(d)[e]{f}|g^h$i*j?k\l`;
        const pattern = new RegExp(uncruisedOf([member]), 'u');

        // Then - only that folder is left out, and a lookalike is not
        expect(pattern.test(`${member}/src/a.ts`)).toBe(true);
        expect(pattern.test(String.raw`axb+c(d)[e]{f}|g^h$i*j?k\l/src/a.ts`)).toBe(false);
        expect(pattern.test(`${member}x/src/a.ts`)).toBe(false);
    });
});
