import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { repository } from '../__setup__/repository.js';
import { cli } from '../cli.specification.js';

describe('test', () => {
    test("runs the project's test script, and answers the same tree from the green it left", async () => {
        // Given - a repository whose test script passes, tested once
        const result = await cli
            .fixture(directory('./__fixtures__/scripted/'))
            .prepare(repository)
            .exec(['test', 'test']);

        // Then - the second run prints its proof, and the script did not run
        expect(result.exitCode).toBe(0);
        expect(result.stdout.text).not.toContain('the tests ran');
        expect(result.stdout.text).toMatch(
            /^ TYPESCRIPT {2}✓ Proven green: this tree passed `typescript test` at \S+ on .+, and no input of its key changed since \(\.artifacts\/proven\/test-[\da-f]{12}…\); nothing ran, and --cold runs it again\n$/u,
        );
    });

    test('runs the script again when asked cold', async () => {
        // Given - the same repository, tested once
        const result = await cli
            .fixture(directory('./__fixtures__/scripted/'))
            .prepare(repository)
            .exec(['test', 'test --cold']);

        // Then - the script ran
        expect(result.exitCode).toBe(0);
        expect(result.stdout.text).toContain('the tests ran');
    });
});
