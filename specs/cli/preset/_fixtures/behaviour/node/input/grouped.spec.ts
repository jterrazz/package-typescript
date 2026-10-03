import { describe, expect, test } from 'vitest';

/*
 * outside: a test file's one `describe` is a function as long as the file, so the
 * function cap would refuse every file past sixty lines. The cap is off under
 * `*.spec.ts`, and `@jterrazz/test`'s `test-body-within-line-limit` caps what it would have caught, a test
 * body. The group below spans more than sixty lines and is reported by nothing.
 */

describe('a group past the function cap', () => {
    test('states claim 1', () => {
        const answer = 1;

        expect(answer).toBe(1);
    });

    test('states claim 2', () => {
        const answer = 2;

        expect(answer).toBe(2);
    });

    test('states claim 3', () => {
        const answer = 3;

        expect(answer).toBe(3);
    });

    test('states claim 4', () => {
        const answer = 4;

        expect(answer).toBe(4);
    });

    test('states claim 5', () => {
        const answer = 5;

        expect(answer).toBe(5);
    });

    test('states claim 6', () => {
        const answer = 6;

        expect(answer).toBe(6);
    });

    test('states claim 7', () => {
        const answer = 7;

        expect(answer).toBe(7);
    });

    test('states claim 8', () => {
        const answer = 8;

        expect(answer).toBe(8);
    });

    test('states claim 9', () => {
        const answer = 9;

        expect(answer).toBe(9);
    });
});
