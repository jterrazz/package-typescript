import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { cli } from '../packed-cli.specification.js';

describe('declarations', () => {
    test('a consumer module compiles against the installed declarations, and every call they must refuse is refused', async () => {
        // Given - a consumer's project on the node tsconfig preset, augmenting the config's interface, each refused call under an `@ts-expect-error`
        const result = await cli
            .fixture(directory('./_fixtures/declarations/'))
            .exec('tsc --project .');

        // Then - nothing is reported: no unmarked line fails, and no marked one compiles
        expect(result.exitCode).toBe(0);
        expect(result.stdout.text).toBe('');
    });
});
