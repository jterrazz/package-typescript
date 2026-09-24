import { describe, expect, test } from 'vitest';

/*
 * A test file's one `describe` is a function as long as the file, so the
 * function cap would refuse every file past sixty lines. The cap is off under
 * `*.test.tsx`, and `@jterrazz/test`'s C34 caps what it would have caught, a test
 * body. The group below spans more than sixty lines and is reported by nothing.
 */

describe('a group past the function cap', () => {
    test('states claim 1', () => {
        // Given - a value the rulebook has no opinion about
        const answer = 1;

        // Then - the length of the group is the subject here, not the assertion
        expect(answer).toBe(1);
    });

    test('states claim 2', () => {
        // Given - a value the rulebook has no opinion about
        const answer = 2;

        // Then - the length of the group is the subject here, not the assertion
        expect(answer).toBe(2);
    });

    test('states claim 3', () => {
        // Given - a value the rulebook has no opinion about
        const answer = 3;

        // Then - the length of the group is the subject here, not the assertion
        expect(answer).toBe(3);
    });

    test('states claim 4', () => {
        // Given - a value the rulebook has no opinion about
        const answer = 4;

        // Then - the length of the group is the subject here, not the assertion
        expect(answer).toBe(4);
    });

    test('states claim 5', () => {
        // Given - a value the rulebook has no opinion about
        const answer = 5;

        // Then - the length of the group is the subject here, not the assertion
        expect(answer).toBe(5);
    });

    test('states claim 6', () => {
        // Given - a value the rulebook has no opinion about
        const answer = 6;

        // Then - the length of the group is the subject here, not the assertion
        expect(answer).toBe(6);
    });

    test('states claim 7', () => {
        // Given - a value the rulebook has no opinion about
        const answer = 7;

        // Then - the length of the group is the subject here, not the assertion
        expect(answer).toBe(7);
    });

    test('states claim 8', () => {
        // Given - a value the rulebook has no opinion about
        const answer = 8;

        // Then - the length of the group is the subject here, not the assertion
        expect(answer).toBe(8);
    });

    test('states claim 9', () => {
        // Given - a value the rulebook has no opinion about
        const answer = 9;

        // Then - the length of the group is the subject here, not the assertion
        expect(answer).toBe(9);
    });
});
