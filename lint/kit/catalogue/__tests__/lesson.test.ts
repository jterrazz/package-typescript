import { describe, expect, test } from 'vitest';

import {
    defineInvariant,
    firstSentence,
    invariant,
    lessonParts,
    missingParts,
    refusal,
    refusalBlock,
} from '../lesson.js';
import type { Lesson } from '../lesson.js';

const LESSON: Lesson = {
    fix: 'replace it with `await waitUntil(() => rows.length > 0)`',
    found: '`setTimeout(…)` in a test',
    read: 'docs/19-linting.md#no-sleep',
    why: 'A test waits on a condition, never on time.',
};

describe('lesson', () => {
    test('one line joins the four parts in order', () => {
        // Given - a lesson rendered for a diagnostic
        const line = refusal(LESSON);

        // Then - one line, each part labelled, in the order a reader acts on them
        expect(line).toBe(
            'found: `setTimeout(…)` in a test · why: A test waits on a condition, never on time. · fix: replace it with `await waitUntil(() => rows.length > 0)` · read: docs/19-linting.md#no-sleep',
        );
    });

    test('a block puts each part on its own line, and a found may span several', () => {
        // Given - a refusal whose finding lists candidates
        const block = refusalBlock({
            ...LESSON,
            found: 'two buttons match:\n  - Save\n  - Save draft',
        });

        // Then - the parts read back whole, the multi-line finding included
        expect(block.split('\n')[0]).toBe('found: two buttons match:');
        expect(lessonParts(block)).toStrictEqual({
            ...LESSON,
            found: 'two buttons match:\n  - Save\n  - Save draft',
        });
    });

    test('both forms read back to the lesson they render', () => {
        // Given - the same lesson in the two forms
        // Then - each parses to the four parts it was built from
        expect(lessonParts(refusal(LESSON))).toStrictEqual(LESSON);
        expect(missingParts(refusal(LESSON))).toStrictEqual([]);
        expect(missingParts(refusalBlock(LESSON))).toStrictEqual([]);
    });

    test.each([
        [
            'a sentence with no part',
            'No arbitrary sleep in a test.',
            ['found', 'why', 'fix', 'read'],
        ],
        ['a missing fix', 'found: x · why: y. · read: docs/19-linting.md#a', ['fix']],
        ['an empty why', 'found: x · why:  · fix: z · read: docs/19-linting.md#a', ['why']],
        [
            'parts out of order',
            'found: x · fix: z · why: y. · read: r',
            ['found', 'why', 'fix', 'read'],
        ],
        [
            'a part stated twice',
            'found: x · why: y · fix: z · fix: w · read: r',
            ['found', 'why', 'fix', 'read'],
        ],
        [
            'text before the finding',
            'Error — found: x · why: y · fix: z · read: r',
            ['found', 'why', 'fix', 'read'],
        ],
    ])('%s is no whole lesson', (_, message, missing) => {
        // Given - a message that lacks a part, or garbles the order
        // Then - the parts it lacks are named
        expect(missingParts(message)).toStrictEqual(missing);
    });

    test.each([
        ['one sentence', 'A test waits on a condition.', 'A test waits on a condition.'],
        ['the first of two', 'A seed is SQL. Anything else is a fixture.', 'A seed is SQL.'],
        [
            'a period in a code span',
            'A `*.spec.ts` sits under `specs/`. Nothing else does.',
            'A `*.spec.ts` sits under `specs/`.',
        ],
        [
            'an abbreviation',
            'A token (e.g. `{{uuid}}`) is matched. Values are not.',
            'A token (e.g. `{{uuid}}`) is matched.',
        ],
        ['a lowercase continuation', 'It reads `x.ts`. then stops', 'It reads `x.ts`. then stops'],
        [
            'a sentence inside a code span',
            'A `TODO. Fix it` marker is refused. Nothing else is.',
            'A `TODO. Fix it` marker is refused.',
        ],
        ['an exclamation', 'Never sleep! A test waits.', 'Never sleep!'],
        ['a question', 'Why wait? A test polls.', 'Why wait?'],
        [
            'two spaces after the stop',
            'A seed is SQL.  Anything else is a fixture.',
            'A seed is SQL.',
        ],
    ])('the why is the first sentence of the row — %s', (_, convention, why) => {
        // Given - a catalogue sentence
        // Then - the why stops where the first sentence does
        expect(firstSentence(convention)).toBe(why);
    });

    test('a part reads without the spaces around it', () => {
        // Given - a lesson written with loose spacing
        // Then - each part is its words alone
        expect(lessonParts('found: x  · why:  y · fix: z\t · read: r ')).toStrictEqual({
            found: 'x',
            fix: 'z',
            read: 'r',
            why: 'y',
        });
    });

    test('an invariant names the package, whose bug it is, and what broke', () => {
        // Given - a package that owns its invariants
        const broken = defineInvariant({
            bugOf: 'the runner',
            notOf: 'the spec',
            package: '@acme/run',
        });

        // Then - the error says the bug is the package's
        expect(broken('a chain ran twice').message).toBe(
            '@acme/run broke one of its own invariants, a bug of the runner, not of the spec: a chain ran twice',
        );
    });

    test('the invariant of this package says the bug is the toolchain’s, not the project’s', () => {
        // Given - a break of this package's own invariant
        // Then - the error names the package, the toolchain and what broke
        expect(invariant('a pass ran twice').message).toBe(
            '@jterrazz/typescript broke one of its own invariants, a bug of the toolchain, not of the project: a pass ran twice',
        );
    });
});
