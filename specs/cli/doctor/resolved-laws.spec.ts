import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { cli } from '../cli.specification.js';

describe('doctor', () => {
    test('names the layer laws that apply to the tree, not the ones of a lint/ tree it does not hold', async () => {
        // Given - a library with a src/ and no lint/ tree
        const result = await cli
            .fixture(directory('./__fixtures__/resolved-plain/'))
            .exec('doctor');

        // Then - no law of the lint/ layers is printed as the project's own
        expect(result.exitCode).toBe(0);
        expect(
            result.stdout.text.split('\n').filter((line) => line.includes(' law ')),
        ).toStrictEqual([]);
    });
});
