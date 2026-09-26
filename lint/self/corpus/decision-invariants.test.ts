import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { PROFILES } from '../../consumer/rulebook/profiles.js';
import { decisions } from '../../engine/catalogue/decisions.js';
import { fragment, off, on, REASON_KINDS, unsafeFix } from '../../engine/compiler/decision.js';
import { lintFragments } from '../../engine/testing/lint-fragments.js';
import problemsOf from './decision-invariants.js';

describe('problemsOf', () => {
    test('every fragment lint/ declares keeps both invariants', async () => {
        // Given - every fragment a module of lint/ or src/ exports, profile or not
        const declared = await lintFragments(resolve(import.meta.dirname, '../../..'));
        expect(declared.length).toBeGreaterThan(15);

        // Then - none breaks either invariant
        expect(declared.flatMap(({ fragment: one }) => problemsOf(one))).toStrictEqual([]);
    });

    test('every decision carries the version it was taken in', () => {
        // Given - the whole catalogue
        const entries = decisions(PROFILES);
        expect(entries.length).toBeGreaterThan(500);

        // Then - each one names a semver, which is what replaces a changelog here
        for (const entry of entries) {
            expect.soft(entry.since, `${entry.rule} has no since`).toMatch(/^\d+\.\d+\.\d+$/u);
        }
    });

    test('names an off with no reason', () => {
        // Given - a decision turned off on nobody's authority
        const probe = fragment({ id: 'probe', rules: { curly: off() } });

        // Then - the audit refuses it
        expect(problemsOf(probe)).toStrictEqual(['probe: "curly" is off with no reason']);
    });

    test('names a reason whose kind is not one of the five', () => {
        // Given - a reason invented on the spot
        const probe = fragment({
            id: 'probe',
            rules: { curly: off({ by: 'taste', kind: 'too-strict' }) },
        });

        // Then - the five are named and the sixth is refused
        expect(problemsOf(probe)).toStrictEqual([
            'probe: "curly" is off for a reason of no known kind',
        ]);
        expect(REASON_KINDS).toHaveLength(5);
    });

    test('names a reason that names nothing', () => {
        // Given - a kind with no rule, page or measurement behind it
        const probe = fragment({ id: 'probe', rules: { curly: off({ by: '', kind: 'covered' }) } });

        // Then - "covered" has to say by what
        expect(problemsOf(probe)).toStrictEqual(['probe: "curly" has a reason that names nothing']);
    });

    test('names a level that is neither error nor off', () => {
        // Given - a fragment reaching for a warning tier
        const probe = fragment({ id: 'probe', rules: { curly: { level: 'warn' } } });

        // Then - there is no warn in this rulebook
        expect(problemsOf(probe)).toStrictEqual([
            'probe: "curly" is "warn" — a rule is error or off',
        ]);
    });

    test('names an unsafe fixer that does not say what it changes', () => {
        // Given - a fixer marked unsafe on no measurement
        const probe = fragment({ id: 'probe', rules: { curly: unsafeFix(on(), '') } });

        // Then - the mark has to carry what the rewrite does
        expect(problemsOf(probe)).toStrictEqual([
            'probe: "curly" marks an unsafe fixer without saying what it changes',
        ]);
    });
});
