import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { cli } from '../packed-cli.specification.js';

describe('mutation-made', () => {
    test('typescript mutation — a mutant that does not compile is answered by the compiler before any test', async () => {
        // Given - a project keeping a tsconfig.json, whose source guards an optional value its module test never passes
        const result = await cli
            .fixture(directory('./__fixtures__/mutation-consumer/'))
            .fixture(directory('./__fixtures__/mutation-killing/'))
            .fixture(directory('./__fixtures__/mutation-type-refused/'))
            .exec('typescript mutation');

        // Then - the mutants that drop the guard reach a value the type says may be undefined, so they are compile errors, outside the verdict, and no test had to tell them apart
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(`
            {{any}}
            measured 8 mutants over HEAD..working tree: every mutant a test runs is detected
            0 mutant(s) no test runs
            6 mutant(s) outside the verdict: CompileError 6

            ✓ Mutation passed: 8 detected, 0 surviving, 0 never judged, over HEAD..working tree
        `);
        expect(result.stdout.text).not.toContain('Measuring the whole suite');
    });

    test("typescript mutation — a tree that does not compile is refused before any mutant, at the compiler's first error", async () => {
        // Given - the consumer beside a source that assigns a number to a string, its module test passing, since vitest checks no type
        const result = await cli
            .fixture(directory('./__fixtures__/mutation-consumer/'))
            .fixture(directory('./__fixtures__/mutation-killing/'))
            .fixture(directory('./__fixtures__/mutation-uncompiled/'))
            .exec('typescript mutation');

        // Then - the run fails, naming the first compile error at its file and line, and says the tree must compile before mutants are judged
        expect(result.exitCode).not.toBe(0);
        expect(result.stdout).toMatch(`
            {{any}}
            found: the tree does not compile before any mutant: src/length.ts:2 TS2322 Type 'number' is not assignable to type 'string'. · why: each mutant is type-checked against the tree it mutates, so a tree the compiler refuses leaves no mutant to judge; the tree must compile before mutants are judged · fix: make the tree compile, then run again: \`typescript check\` names every error, in its TypeScript Check pass · read: docs/reference/quality-checks.md#every-mutant-a-test-runs-is-detected

            ✗ Mutation failed: the tree does not compile before any mutant: src/length.ts:2 TS2322 Type 'number' is not assignable to type 'string'.
        `);
    });

    test('typescript mutation — a statement that only logs is never mutated, and the verdict says so', async () => {
        // Given - the consumer, its test judging everything, beside a source that logs through console and a logger around the price it decides, its module test judging the price alone
        const result = await cli
            .fixture(directory('./__fixtures__/mutation-consumer/'))
            .fixture(directory('./__fixtures__/mutation-killing/'))
            .fixture(directory('./__fixtures__/mutation-logs/'))
            .exec('typescript mutation');

        // Then - the mutants of the two log statements are set aside before any run, counted by what set them aside, and none survives
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(`
            {{any}}
            measured 16 mutants over HEAD..working tree: every mutant a test runs is detected
            0 mutant(s) no test runs
            4 mutant(s) outside the verdict: Ignored 4 (log calls 4)

            ✓ Mutation passed: 16 detected, 0 surviving, 0 never judged, over HEAD..working tree
        `);
        expect(result.stdout.text).not.toContain('Measuring the whole suite');
    });

    test('typescript mutation — the text a declared presentation file prints is never mutated, and the verdict says so', async () => {
        // Given - the consumer, its test judging everything, beside a headline the project declares presentation, its module test comparing the headline whole
        const result = await cli
            .fixture(directory('./__fixtures__/mutation-consumer/'))
            .fixture(directory('./__fixtures__/mutation-killing/'))
            .fixture(directory('./__fixtures__/mutation-presentation/'))
            .exec('typescript mutation');

        // Then - the two texts are set aside before any run, counted as pinned text, and the headline is judged as glue
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(`
            {{any}}
            measured 14 mutants over HEAD..working tree: every mutant a test runs is detected
            glue: 5 of 5 detected (100 %), its bar 90 %
            0 mutant(s) no test runs
            2 mutant(s) outside the verdict: Ignored 2 (pinned text 2)

            ✓ Mutation passed: 14 detected, 0 surviving, 0 never judged, over HEAD..working tree
        `);
        expect(result.stdout.text).not.toContain('Measuring the whole suite');
    });
});
