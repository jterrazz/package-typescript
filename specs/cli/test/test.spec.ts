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

        // Then - the second run prints its proof, and the script did not run, so only the first run's outcome is recorded
        expect(result.exitCode).toBe(0);
        expect(result.file('.artifacts/check/outcomes.jsonl').content).toMatch(
            /^\{"at":"[^"]+","command":"test","head":null,"kind":"pass","name":"Tests","seconds":[\d.]+,"status":"green"\}\n$/u,
        );
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

        // Then - the script ran, over every test file, and says so
        expect(result.exitCode).toBe(0);
        expect(result.stdout.text).toContain('the tests ran');
        expect(result.stdout.text).toContain(' TYPESCRIPT  ran every test file: asked --cold\n');
    });

    test('records a run whose script failed as a red pass, and keeps no proof of it', async () => {
        // Given - a repository whose test script fails
        const result = await cli
            .fixture(directory('./__fixtures__/failing/'))
            .prepare(repository)
            .exec('test');

        // Then - the run failed, its outcome is one red line, and no proof stands for the tree
        expect(result.exitCode).toBe(1);
        expect(JSON.parse(result.file('.artifacts/check/outcomes.jsonl').content)).toMatchObject({
            command: 'test',
            kind: 'pass',
            name: 'Tests',
            status: 'red',
        });
        expect(result.file('.artifacts/proven').exists).toBe(false);
    });
});
